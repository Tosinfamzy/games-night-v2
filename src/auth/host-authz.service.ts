import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ClerkService } from './clerk.service';
import { GamesMasterService } from '../games-master/games-master.service';
import { Session } from '../session/session.entity';
import { Game } from '../game/game.entity';
import { Score } from '../score/score.entity';
import { Player } from '../player/player.entity';
import { Team } from '../team/team.entity';
import { DomainError } from '../common/errors/domain-errors';
import { extractBearerToken } from '../common/utils/bearer.util';
import { HostOfMeta } from './decorators/host-of.decorator';

interface PlayerTokenPayload {
  playerId: string;
  sessionId: string;
  playerName: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Encapsulates host-authorization: resolve a route's target session and verify
 * the caller's session-scoped player token belongs to that session's host.
 *
 * Lives in AuthModule (which owns the repos + AuthService) so HostGuard can stay
 * a thin, repo-free provider that resolves in any module importing AuthModule.
 */
@Injectable()
export class HostAuthzService {
  constructor(
    private readonly authService: AuthService,
    private readonly clerk: ClerkService,
    private readonly gamesMasterService: GamesMasterService,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(Score)
    private readonly scoreRepo: Repository<Score>,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
  ) {}

  /** Throws if the request isn't from the target session's host; else true. */
  async authorize(request: Request, meta: HostOfMeta): Promise<boolean> {
    const token = extractBearerToken(request);
    if (!token) {
      throw DomainError.invalidToken(
        'A valid player or games-master token is required for this action',
      );
    }

    // Fast path: session-scoped player token (local HS256 verify, no network).
    // This is the common in-session case, so it's tried first.
    const player = this.authService.validatePlayerToken(token);
    if (player) {
      return this.authorizeByPlayer(player, meta, request);
    }

    // Cross-device host: a Clerk games-master JWT (RS256, verified via Clerk).
    const clerkUserId = await this.clerk.verify(token);
    if (clerkUserId) {
      return this.authorizeByClerkGm(clerkUserId, meta, request);
    }

    throw DomainError.invalidToken(
      'A valid player or games-master token is required for this action',
    );
  }

  /** Authorize via the caller's session-scoped player token. */
  private async authorizeByPlayer(
    player: PlayerTokenPayload,
    meta: HostOfMeta,
    request: Request,
  ): Promise<boolean> {
    // Fail closed: a malformed/missing id is deferred to the pipe/handler (so a
    // bad request still 400s), but a well-formed id that resolves to nothing is
    // rejected here (404) rather than let through.
    const rawId = this.extractRawId(meta, request);
    if (!rawId || !UUID_RE.test(rawId)) {
      return true;
    }
    const sessionId = await this.resolveSessionId(meta, request);
    if (!sessionId) {
      throw new NotFoundException('Target resource not found');
    }

    // The token is session-scoped: it must match the session being acted on.
    if (player.sessionId !== sessionId) {
      throw new ForbiddenException(
        'Your session token does not match this session',
      );
    }

    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['host'],
    });
    const callerPlayer = await this.playerRepo.findOne({
      where: { id: player.playerId },
    });
    const isHost = Boolean(
      callerPlayer?.userId &&
      session?.host?.id &&
      callerPlayer.userId === session.host.id,
    );
    if (!isHost) {
      throw new ForbiddenException('Only the session host can do this');
    }

    return true;
  }

  /** Authorize via a Clerk-authenticated games master (cross-device control). */
  private async authorizeByClerkGm(
    clerkUserId: string,
    meta: HostOfMeta,
    request: Request,
  ): Promise<boolean> {
    const rawId = this.extractRawId(meta, request);
    if (!rawId || !UUID_RE.test(rawId)) {
      return true;
    }
    const sessionId = await this.resolveSessionId(meta, request);
    if (!sessionId) {
      throw new NotFoundException('Target resource not found');
    }

    const gm = await this.gamesMasterService.findByClerkUserId(clerkUserId);
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['host'],
    });
    const isHost = Boolean(
      gm?.id && session?.host?.id && gm.id === session.host.id,
    );
    if (!isHost) {
      throw new ForbiddenException('Only the session host can do this');
    }

    return true;
  }

  /**
   * Authorize a session player-status action: the caller must belong to the
   * session and be either the target player themselves (self-service, e.g.
   * marking your own ready) or the session host (setting anyone's status).
   * Without this, any anonymous caller could re-status any player.
   */
  async authorizeSessionActor(
    request: Request,
    meta: { session: string; player: string },
  ): Promise<boolean> {
    const token = extractBearerToken(request);
    if (!token) {
      throw DomainError.invalidToken(
        'A valid token is required for this action',
      );
    }

    const params = request.params as Record<string, string>;
    const sessionId = params[meta.session];
    const targetPlayerId = params[meta.player];
    // Malformed/missing id: defer to the handler (404/400) rather than 500.
    if (!sessionId || !UUID_RE.test(sessionId)) {
      return true;
    }

    // Player-token path: allow a player acting on themselves, or the host.
    const player = this.authService.validatePlayerToken(token);
    if (player) {
      if (player.sessionId !== sessionId) {
        throw new ForbiddenException(
          'Your session token does not match this session',
        );
      }
      if (player.playerId === targetPlayerId) {
        return true; // self
      }
      if (await this.isSessionHostByPlayer(player.playerId, sessionId)) {
        return true;
      }
      throw new ForbiddenException(
        'Only the player themselves or the session host can change this',
      );
    }

    // Clerk games-master path: the host acts on any player.
    const clerkUserId = await this.clerk.verify(token);
    if (clerkUserId) {
      if (await this.isSessionHostByGm(clerkUserId, sessionId)) {
        return true;
      }
      throw new ForbiddenException('Only the session host can do this');
    }

    throw DomainError.invalidToken('A valid token is required for this action');
  }

  /**
   * Authorize a session-scoped read: the caller must belong to the session (any
   * player token for it) or be its host (Clerk games-master). Without this, any
   * caller holding a session/game/team id could enumerate participants, teams,
   * and scores.
   */
  async authorizeSessionMember(
    request: Request,
    meta: HostOfMeta,
  ): Promise<boolean> {
    const token = extractBearerToken(request);
    if (!token) {
      throw DomainError.invalidToken(
        'A valid token is required to view this resource',
      );
    }

    // Malformed/missing id: defer to the pipe/handler (400/404) rather than 500.
    const rawId = this.extractRawId(meta, request);
    if (!rawId || !UUID_RE.test(rawId)) {
      return true;
    }
    const sessionId = await this.resolveSessionId(meta, request);
    if (!sessionId) {
      throw new NotFoundException('Target resource not found');
    }

    // Player token: any member of this session may read it.
    const player = this.authService.validatePlayerToken(token);
    if (player) {
      if (player.sessionId !== sessionId) {
        throw new ForbiddenException(
          'Your session token does not match this session',
        );
      }
      return true;
    }

    // Clerk games-master: only the session's own host may read it.
    const clerkUserId = await this.clerk.verify(token);
    if (clerkUserId) {
      if (await this.isSessionHostByGm(clerkUserId, sessionId)) {
        return true;
      }
      throw new ForbiddenException('Only the session host can view this');
    }

    throw DomainError.invalidToken(
      'A valid token is required to view this resource',
    );
  }

  private async isSessionHostByPlayer(
    playerId: string,
    sessionId: string,
  ): Promise<boolean> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['host'],
    });
    const callerPlayer = await this.playerRepo.findOne({
      where: { id: playerId },
    });
    return Boolean(
      callerPlayer?.userId &&
      session?.host?.id &&
      callerPlayer.userId === session.host.id,
    );
  }

  private async isSessionHostByGm(
    clerkUserId: string,
    sessionId: string,
  ): Promise<boolean> {
    const gm = await this.gamesMasterService.findByClerkUserId(clerkUserId);
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['host'],
    });
    return Boolean(gm?.id && session?.host?.id && gm.id === session.host.id);
  }

  /** The raw target id from the route param or request body (unvalidated). */
  private extractRawId(meta: HostOfMeta, request: Request): string | undefined {
    const params = request.params as Record<string, string>;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const fromBody =
      typeof body[meta.param] === 'string'
        ? (body[meta.param] as string)
        : undefined;
    return params[meta.param] ?? fromBody;
  }

  private async resolveSessionId(
    meta: HostOfMeta,
    request: Request,
  ): Promise<string | null> {
    const id = this.extractRawId(meta, request);
    // Bail on missing / malformed ids so a bad request never reaches the DB as
    // an invalid-uuid query (which would 500). The handler/pipe rejects it.
    if (!id || !UUID_RE.test(id)) {
      return null;
    }
    try {
      switch (meta.from) {
        case 'session':
          return id;
        case 'game': {
          // Game.session is eager.
          const game = await this.gameRepo.findOne({ where: { id } });
          return game?.session?.id ?? null;
        }
        case 'score': {
          // Score.game and Game.session are eager.
          const score = await this.scoreRepo.findOne({ where: { id } });
          return score?.game?.session?.id ?? null;
        }
        case 'team': {
          // Team.session and Team.game are eager (game.session eager).
          const team = await this.teamRepo.findOne({ where: { id } });
          return team?.session?.id ?? team?.game?.session?.id ?? null;
        }
        case 'player': {
          // Player.session is eager.
          const player = await this.playerRepo.findOne({ where: { id } });
          return player?.session?.id ?? null;
        }
        default:
          return null;
      }
    } catch {
      return null;
    }
  }
}
