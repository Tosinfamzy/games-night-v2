import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GamesMaster } from '../../games-master/games-master.entity';

/**
 * Injects the Clerk-authenticated GamesMaster attached by ClerkAuthGuard /
 * OptionalClerkAuthGuard. Undefined when the request had no valid Clerk token
 * (only possible under the optional guard).
 */
export const CurrentGm = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): GamesMaster | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ gamesMaster?: GamesMaster }>();
    return request.gamesMaster;
  },
);
