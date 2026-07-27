import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { findOneOrThrow } from '../common/utils/find-or-throw.util';
import { Session } from '../session/session.entity';
import { Invite } from './invite.entity';
import { RsvpStatus } from './enums/rsvp-status.enum';
import { CreateInviteDto } from './dto/create-invite.dto';
import { RsvpDto } from './dto/rsvp.dto';

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
  constructor(
    @InjectRepository(Invite)
    private readonly inviteRepo: Repository<Invite>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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
