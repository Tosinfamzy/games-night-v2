import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { HostAuthzService } from '../host-authz.service';
import {
  SESSION_ACTOR_KEY,
  SessionActorMeta,
} from '../decorators/session-actor.decorator';

/**
 * Authorizes session player-status actions (self-ready, host-set-ready/status).
 *
 * Unlike HostGuard, this allows the target player to act on themselves as well
 * as the session host. A route opts in with @SessionActor; the check is
 * delegated to HostAuthzService. Routes without @SessionActor are untouched.
 */
@Injectable()
export class SessionActorGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly hostAuthz: HostAuthzService,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const meta = this.reflector.get<SessionActorMeta | undefined>(
      SESSION_ACTOR_KEY,
      context.getHandler(),
    );
    if (!meta) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    return this.hostAuthz.authorizeSessionActor(request, meta);
  }
}
