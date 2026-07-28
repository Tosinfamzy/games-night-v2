import { ForbiddenException, Injectable } from '@nestjs/common';
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
    const sessionId = await this.resolveSessionId(meta, request);
    // Unresolvable target (missing / malformed / non-existent id): no real
    // resource to protect, so defer to the handler, which will 400/404 it.
    // Guards run before validation pipes, so this keeps those responses intact.
    if (!sessionId) {
      return true;
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
    const sessionId = await this.resolveSessionId(meta, request);
    if (!sessionId) {
      return true;
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

  private async resolveSessionId(
    meta: HostOfMeta,
    request: Request,
  ): Promise<string | null> {
    const params = request.params as Record<string, string>;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const fromBody =
      typeof body[meta.param] === 'string'
        ? (body[meta.param] as string)
        : undefined;
    const id = params[meta.param] ?? fromBody;
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
        default:
          return null;
      }
    } catch {
      return null;
    }
  }
}
