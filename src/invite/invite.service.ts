import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { findOneOrThrow } from '../common/utils/find-or-throw.util';
import { Session } from '../session/session.entity';
import {
  SessionPlayerService,
  JoinSessionResult,
} from '../session/services/session-player.service';
import { Invite } from './invite.entity';
import { RsvpStatus } from './enums/rsvp-status.enum';
import { CreateInviteDto } from './dto/create-invite.dto';
import { RsvpDto } from './dto/rsvp.dto';
import { PublicRsvpDto } from './dto/public-rsvp.dto';
import { PublicRsvpViewDto } from './dto/public-rsvp-view.dto';
import {
  PLAYER_JOINED_EVENT,
  PlayerJoinedEvent,
} from '../common/events/player-joined.event';

export interface InviteSummary {
  total: number;
  pending: number;
  going: number;
  maybe: number;
  notGoing: number;
  /** Expected headcount: everyone marked GOING, plus their plus-ones. */
  headcount: number;
}

@Injectable()
export class InviteService {
  private readonly logger = new Logger(InviteService.name);

  constructor(
    @InjectRepository(Invite)
    private readonly inviteRepo: Repository<Invite>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    private readonly eventEmitter: EventEmitter2,
    private readonly sessionPlayerService: SessionPlayerService,
  ) {}

  /**
   * Public: a guest joins the live session straight from their invite link — no
   * join code needed. Delegates to the normal join flow (keyed off the invite's
   * session), so all its rules apply: only joinable while SCHEDULED, no duplicate
   * players, and the PLAYER_JOINED bridge auto-checks-in this very invite (it
   * matches by name — so we join under the name they RSVP'd with).
   */
  async joinViaInvite(
    token: string,
    name?: string,
  ): Promise<JoinSessionResult> {
    const invite = await this.findByToken(token);
    if (!invite.session) {
      throw new NotFoundException('This invite is not linked to a session');
    }
    const playerName = invite.name?.trim() || name?.trim() || 'Guest';
    return this.sessionPlayerService.joinSession({
      joinCode: invite.session.joinCode,
      playerName,
    });
  }

  /** GM adds a named guest to a session's guest list. */
  async createForSession(
    sessionId: string,
    dto: CreateInviteDto,
  ): Promise<Invite> {
    const session = await findOneOrThrow(
      this.sessionRepo,
      { id: sessionId },
      `Session with ID ${sessionId} not found`,
    );

    const invite = this.inviteRepo.create({
      session,
      name: dto.name,
      email: dto.email,
      inviteToken: randomUUID(),
      rsvpStatus: RsvpStatus.PENDING,
    });
    const saved = await this.inviteRepo.save(invite);

    this.eventEmitter.emit('invite.updated', { sessionId, invite: saved });
    return saved;
  }

  /** The session's full guest list. */
  findBySession(sessionId: string): Promise<Invite[]> {
    return this.inviteRepo.find({
      where: { session: { id: sessionId } },
      order: { createdAt: 'ASC' },
    });
  }

  /** RSVP tallies for the GM dashboard. */
  async summary(sessionId: string): Promise<InviteSummary> {
    const invites = await this.findBySession(sessionId);
    const summary: InviteSummary = {
      total: invites.length,
      pending: 0,
      going: 0,
      maybe: 0,
      notGoing: 0,
      headcount: 0,
    };

    for (const invite of invites) {
      switch (invite.rsvpStatus) {
        case RsvpStatus.GOING:
          summary.going += 1;
          summary.headcount += 1 + invite.plusOnes;
          break;
        case RsvpStatus.MAYBE:
          summary.maybe += 1;
          break;
        case RsvpStatus.NOT_GOING:
          summary.notGoing += 1;
          break;
        default:
          summary.pending += 1;
      }
    }

    return summary;
  }

  /** Public: look up an invite by its token (includes session details to render). */
  findByToken(token: string): Promise<Invite> {
    return findOneOrThrow(
      this.inviteRepo,
      { inviteToken: token },
      'Invite not found',
      ['session', 'session.host'],
    );
  }

  /** Public: a guest submits or updates their RSVP via their token. */
  async rsvp(token: string, dto: RsvpDto): Promise<Invite> {
    const invite = await this.findByToken(token);

    invite.rsvpStatus = dto.status;
    if (dto.name) invite.name = dto.name;
    if (dto.plusOnes !== undefined) invite.plusOnes = dto.plusOnes;
    if (dto.note !== undefined) invite.note = dto.note;
    invite.respondedAt = new Date();

    const saved = await this.inviteRepo.save(invite);
    this.eventEmitter.emit('invite.updated', {
      sessionId: invite.sessionId,
      invite: saved,
    });
    return saved;
  }

  // ----- Single shareable RSVP link (open self-serve) -----

  /**
   * Public: event details behind a session's shareable RSVP link. A narrow,
   * no-auth projection — never the host email, join code, or full guest list.
   */
  async getPublicRsvpView(rsvpToken: string): Promise<PublicRsvpViewDto> {
    const session = await findOneOrThrow(
      this.sessionRepo,
      { publicRsvpToken: rsvpToken },
      'Event not found',
      ['host'],
    );
    const { headcount } = await this.summary(session.id);

    return {
      sessionId: session.id,
      sessionName: session.name,
      date: session.date,
      location: session.location ?? null,
      description: session.description ?? null,
      inviteMessage: session.inviteMessage ?? null,
      hostName: session.host?.name ?? null,
      goingHeadcount: headcount,
    };
  }

  /**
   * Public: a guest self-RSVPs via the shareable link. Creates a new invite, or
   * updates their existing one so repeat submissions don't pile up duplicates
   * (matched by email when given, otherwise by case-insensitive name).
   */
  async selfRsvp(rsvpToken: string, dto: PublicRsvpDto): Promise<Invite> {
    const session = await findOneOrThrow(
      this.sessionRepo,
      { publicRsvpToken: rsvpToken },
      'Event not found',
      ['host'],
    );

    const existing = await this.findExistingForSelfRsvp(
      session.id,
      dto.name,
      dto.email,
    );

    const invite =
      existing ??
      this.inviteRepo.create({
        session,
        inviteToken: randomUUID(),
        rsvpStatus: RsvpStatus.PENDING,
      });

    invite.name = dto.name;
    if (dto.email !== undefined) invite.email = dto.email;
    invite.rsvpStatus = dto.status;
    invite.plusOnes = dto.status === RsvpStatus.GOING ? (dto.plusOnes ?? 0) : 0;
    if (dto.note !== undefined) invite.note = dto.note;
    invite.respondedAt = new Date();

    const saved = await this.inviteRepo.save(invite);
    // Attach the (host-loaded) session so the public response can render event
    // details — the dedupe path loads the invite without its session relation.
    saved.session = session;
    this.eventEmitter.emit('invite.updated', {
      sessionId: session.id,
      invite: saved,
    });
    return saved;
  }

  /** Find an invite to update for an open-link RSVP: by email, else by name. */
  private findExistingForSelfRsvp(
    sessionId: string,
    name: string,
    email?: string,
  ): Promise<Invite | null> {
    const qb = this.inviteRepo
      .createQueryBuilder('invite')
      .where('invite.sessionId = :sessionId', { sessionId });

    if (email) {
      qb.andWhere('LOWER(invite.email) = LOWER(:email)', { email });
    } else {
      qb.andWhere('invite.email IS NULL').andWhere(
        'LOWER(invite.name) = LOWER(:name)',
        { name },
      );
    }

    return qb.orderBy('invite.createdAt', 'ASC').getOne();
  }

  // ----- Player-join bridge -----

  /**
   * When a player joins by code, link a matching guest-list invite (same
   * session, not yet linked, same name case-insensitively) to that player and
   * mark them GOING — so the guest list reflects who actually turned up. No
   * match is fine (walk-ins without an RSVP). Never throws into the join flow.
   */
  @OnEvent(PLAYER_JOINED_EVENT)
  async linkPlayerToInvite(event: PlayerJoinedEvent): Promise<void> {
    try {
      const invite = await this.inviteRepo
        .createQueryBuilder('invite')
        .where('invite.sessionId = :sessionId', { sessionId: event.sessionId })
        .andWhere('invite.playerId IS NULL')
        .andWhere('LOWER(invite.name) = LOWER(:name)', {
          name: event.playerName,
        })
        .orderBy('invite.createdAt', 'ASC')
        .getOne();

      if (!invite) return;

      invite.playerId = event.playerId;
      if (
        invite.rsvpStatus === RsvpStatus.PENDING ||
        invite.rsvpStatus === RsvpStatus.MAYBE
      ) {
        invite.rsvpStatus = RsvpStatus.GOING;
      }
      const saved = await this.inviteRepo.save(invite);
      this.eventEmitter.emit('invite.updated', {
        sessionId: event.sessionId,
        invite: saved,
      });
    } catch (error) {
      // Bridging is best-effort; a failure must not break joining a session.
      this.logger.warn(
        `Failed to link player ${event.playerId} to an invite in session ${event.sessionId}: ${String(error)}`,
      );
    }
  }

  /** GM removes a guest from the list. */
  async remove(sessionId: string, inviteId: string): Promise<void> {
    const invite = await findOneOrThrow(
      this.inviteRepo,
      { id: inviteId, session: { id: sessionId } },
      `Invite with ID ${inviteId} not found in session ${sessionId}`,
    );
    await this.inviteRepo.remove(invite);
    this.eventEmitter.emit('invite.updated', { sessionId, invite: null });
  }
}
