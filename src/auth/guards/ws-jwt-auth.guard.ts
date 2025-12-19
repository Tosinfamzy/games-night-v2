import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtAuthGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();

    try {
      // Extract token from handshake auth or headers
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(`WebSocket connection without token: ${client.id}`);
        throw new WsException('Unauthorized: No token provided');
      }

      // Verify and decode the JWT
      const payload = await this.jwtService.verifyAsync(token);

      // Attach user data to socket for later use
      client.data.user = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        profileId: payload.profileId,
      };

      this.logger.log(
        `WebSocket authenticated: ${client.id} (User: ${payload.email})`,
      );

      return true;
    } catch (error) {
      this.logger.error(`WebSocket auth failed: ${error.message}`);
      throw new WsException('Unauthorized: Invalid token');
    }
  }

  private extractToken(client: Socket): string | null {
    // Try to get token from socket.handshake.auth.token (preferred)
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }

    // Fall back to Authorization header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }
}
