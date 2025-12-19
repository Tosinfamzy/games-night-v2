import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthService } from '../auth.service';

/**
 * WebSocket guard for player authentication
 * Validates player tokens and attaches player info to socket
 */
@Injectable()
export class WsPlayerAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsPlayerAuthGuard.name);

  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();

    try {
      // Extract token from handshake auth
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(
          `WebSocket connection without player token: ${client.id}`,
        );
        throw new WsException('Unauthorized: No player token provided');
      }

      // Validate player token
      const playerData = this.authService.validatePlayerToken(token) as {
        playerId: string;
        sessionId: string;
        playerName: string;
      } | null;

      if (!playerData) {
        this.logger.warn(`WebSocket invalid player token: ${client.id}`);
        throw new WsException('Unauthorized: Invalid or expired player token');
      }

      // Attach player data to socket for later use in handlers
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      client.data.player = {
        playerId: playerData.playerId,
        sessionId: playerData.sessionId,
        playerName: playerData.playerName,
      };

      this.logger.log(
        `WebSocket player authenticated: ${client.id} (Player: ${playerData.playerName}, Session: ${playerData.sessionId})`,
      );

      return true;
    } catch (error: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.error(`WebSocket player auth failed: ${error.message}`);
      throw new WsException('Unauthorized: Invalid player token');
    }
  }

  private extractToken(client: Socket): string | null {
    // Try to get token from socket.handshake.auth.playerToken (preferred)
    if (client.handshake.auth?.playerToken) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return client.handshake.auth.playerToken;
    }

    // Fall back to auth.token for backwards compatibility
    if (client.handshake.auth?.token) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return client.handshake.auth.token;
    }

    // Fall back to query parameter
    if (client.handshake.query?.playerToken) {
      return client.handshake.query.playerToken as string;
    }

    return null;
  }
}
