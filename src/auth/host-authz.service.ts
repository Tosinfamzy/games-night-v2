import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Session } from '../session/session.entity';
import { Game } from '../game/game.entity';
import { Score } from '../score/score.entity';
import { Player } from '../player/player.entity';
import { DomainError } from '../common/errors/domain-errors';
import { HostOfMeta } from './decorators/host-of.decorator';

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
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(Score)
    private readonly scoreRepo: Repository<Score>,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
  ) {}

  /** Throws if the request isn't from the target session's host; else true. */
  async authorize(request: Request, meta: HostOfMeta): Promise<boolean> {
    const token = this.extractToken(request);
    const player = token ? this.authService.validatePlayerToken(token) : null;
    if (!player) {
      throw DomainError.invalidToken(
        'A valid player token is required for this action',
      );
    }

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

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim() || null;
    }
    return null;
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
        default:
          return null;
      }
    } catch {
      return null;
    }
  }
}
