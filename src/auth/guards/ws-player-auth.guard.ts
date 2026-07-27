import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { AuthService } from '../auth.service';
import { AppSocket } from '../../common/types/socket.types';
import { getErrorMessage } from '../../common/utils/error.util';
import { extractPlayerToken } from '../../common/utils/ws-token.util';

/**
 * WebSocket guard for player authentication
 * Validates player tokens and attaches player info to socket
 */
@Injectable()
export class WsPlayerAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsPlayerAuthGuard.name);

  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<AppSocket>();

    try {
      // Extract token from handshake auth (shared with AuthenticatedIoAdapter)
      const token = extractPlayerToken(client.handshake);

      if (!token) {
        this.logger.warn(
          `WebSocket connection without player token: ${client.id}`,
        );
        throw new WsException('Unauthorized: No player token provided');
      }

      // Validate player token
      const playerData = this.authService.validatePlayerToken(token);

      if (!playerData) {
        this.logger.warn(`WebSocket invalid player token: ${client.id}`);
        throw new WsException('Unauthorized: Invalid or expired player token');
      }

      // Attach player data to socket for later use in handlers
      client.data.player = {
        playerId: playerData.playerId,
        sessionId: playerData.sessionId,
        playerName: playerData.playerName,
      };

      this.logger.log(
        `WebSocket player authenticated: ${client.id} (Player: ${playerData.playerName}, Session: ${playerData.sessionId})`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `WebSocket player auth failed: ${getErrorMessage(error)}`,
      );
      throw new WsException('Unauthorized: Invalid player token');
    }
  }
}
