import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AppSocket, WsAuthUser } from '../../common/types/socket.types';

/** Backwards-compatible alias for the authenticated WebSocket user shape. */
export type WsUser = WsAuthUser;

/**
 * Decorator to extract authenticated user from WebSocket connection
 * Usage: @WsCurrentUser() user: WsUser
 */
export const WsCurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): WsUser => {
    const client = ctx.switchToWs().getClient<AppSocket>();
    // Populated by WsJwtAuthGuard before any handler runs.
    return client.data.user!;
  },
);
