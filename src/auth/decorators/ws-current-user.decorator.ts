import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';

export interface WsUser {
  userId: string;
  email: string;
  role: string;
  profileId?: string;
}

/**
 * Decorator to extract authenticated user from WebSocket connection
 * Usage: @WsCurrentUser() user: WsUser
 */
export const WsCurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): WsUser => {
    const client: Socket = ctx.switchToWs().getClient();
    return client.data.user;
  },
);
