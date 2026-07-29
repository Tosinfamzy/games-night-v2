import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DataSource } from 'typeorm';
import { Server, ServerOptions } from 'socket.io';
import { AuthService } from '../../auth/auth.service';
import { Player } from '../../player/player.entity';
import { extractPlayerToken } from '../utils/ws-token.util';
import { ErrorCode } from '../errors/error-code.enum';
import { AppSocketData } from '../types/socket.types';

/**
 * IoAdapter that authenticates the Socket.IO handshake for the player-scoped
 * namespaces.
 *
 * NestJS class-level `@UseGuards` runs only on `@SubscribeMessage` handlers, not
 * on the connection lifecycle, so without connection middleware `socket.data.player`
 * is never set at connect — and SessionGateway/ChatGateway then disconnect every
 * client. This installs handshake middleware that validates the player token and
 * populates `socket.data.player` before `handleConnection` runs, restoring
 * real-time for all namespaces.
 */
export class AuthenticatedIoAdapter extends IoAdapter {
  private static readonly AUTH_NAMESPACES = ['/sessions', '/games', '/chat'];
  private readonly logger = new Logger(AuthenticatedIoAdapter.name);

  // AbstractWsAdapter does not retain the Nest app, so keep our own reference to
  // resolve AuthService lazily inside createIOServer (runs during app.listen,
  // when the DI container is fully initialized).
  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    // super preserves the per-gateway CORS/options untouched.
    const server = super.createIOServer(port, options) as Server;
    const authService = this.app.get(AuthService, { strict: false });
    const playerRepo = this.app
      .get(DataSource, { strict: false })
      .getRepository(Player);

    for (const namespace of AuthenticatedIoAdapter.AUTH_NAMESPACES) {
      // Per-namespace: `server.use(...)` only applies to the default '/' namespace.
      server.of(namespace).use((socket, next) => {
        void (async () => {
          try {
            const token = extractPlayerToken(socket.handshake);
            const player = token
              ? authService.validatePlayerToken(token)
              : null;

            if (!player) {
              return next(this.unauthorized('Invalid or expired player token'));
            }

            // A player token stays signed-valid for 24h; re-check the player
            // still exists in that session so a kicked/removed player can't keep
            // reconnecting the sockets on an otherwise-valid token.
            const stillMember = await playerRepo.exists({
              where: {
                id: player.playerId,
                session: { id: player.sessionId },
              },
            });
            if (!stillMember) {
              return next(this.unauthorized('Player is no longer in session'));
            }

            (socket.data as AppSocketData).player = {
              playerId: player.playerId,
              sessionId: player.sessionId,
              playerName: player.playerName,
            };
            return next();
          } catch (error) {
            this.logger.error(
              `WS handshake auth error on ${namespace}: ${String(error)}`,
            );
            return next(this.unauthorized('Invalid player token'));
          }
        })();
      });
    }

    return server;
  }

  /**
   * Handshake error carrying the same `{ code, message }` shape the global
   * exception filter emits for WS, so the frontend `classifyConnectError` can
   * branch on `error.data.code` (TOKEN_INVALID -> rejoin) uniformly.
   */
  private unauthorized(message: string): Error & { data: unknown } {
    const error = new Error(message) as Error & { data: unknown };
    error.data = { code: ErrorCode.TOKEN_INVALID, message };
    return error;
  }
}
