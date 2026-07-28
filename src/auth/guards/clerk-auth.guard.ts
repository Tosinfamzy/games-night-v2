import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ClerkService } from '../clerk.service';
import { GamesMasterService } from '../../games-master/games-master.service';
import { GamesMaster } from '../../games-master/games-master.entity';
import { DomainError } from '../../common/errors/domain-errors';
import { extractBearerToken } from '../../common/utils/bearer.util';

export interface RequestWithGamesMaster extends Request {
  gamesMaster?: GamesMaster;
}

/**
 * Authenticates a games master via a Clerk session JWT (sent as a Bearer
 * token). On success, lazily finds-or-creates the linked GamesMaster and
 * attaches it as `request.gamesMaster` (read via `@CurrentGm()`).
 *
 * Required by default: no valid Clerk token → TOKEN_INVALID. The optional
 * variant below never rejects — it only attaches a GM when one is present —
 * so an endpoint can accept a Clerk-authed host *or* fall back to a legacy
 * path (see session create).
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  protected readonly optional: boolean = false;

  constructor(
    protected readonly clerk: ClerkService,
    protected readonly gamesMasterService: GamesMasterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithGamesMaster>();
    const token = extractBearerToken(request);
    const clerkUserId = token ? await this.clerk.verify(token) : null;

    if (!clerkUserId) {
      if (this.optional) {
        return true;
      }
      throw DomainError.invalidToken(
        'Sign in as a games master to perform this action',
      );
    }

    const name = await this.clerk.getDisplayName(clerkUserId);
    request.gamesMaster =
      await this.gamesMasterService.findOrCreateByClerkUserId(
        clerkUserId,
        name,
      );
    return true;
  }
}

/**
 * Attaches `request.gamesMaster` when a valid Clerk token is present, but
 * never rejects the request when it isn't — leaving legacy/anonymous paths
 * intact. Used on session create during the Clerk cutover.
 */
@Injectable()
export class OptionalClerkAuthGuard extends ClerkAuthGuard {
  protected readonly optional = true;
}
