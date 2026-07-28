import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { HostAuthzService } from '../host-authz.service';
import { HOST_OF_KEY, HostOfMeta } from '../decorators/host-of.decorator';

/**
 * Authorizes host-only HTTP actions (game control, scoring, session lifecycle).
 *
 * The app has no games-master login; the only credential a host holds is the
 * session-scoped player token issued on session create (sent as `Bearer`). A
 * route opts in with @HostOf, and the guard delegates the check to
 * HostAuthzService. Routes without @HostOf (create, join/rejoin, invite/RSVP,
 * reads) are untouched.
 */
@Injectable()
export class HostGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly hostAuthz: HostAuthzService,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const meta = this.reflector.get<HostOfMeta | undefined>(
      HOST_OF_KEY,
      context.getHandler(),
    );
    if (!meta) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    return this.hostAuthz.authorize(request, meta);
  }
}
