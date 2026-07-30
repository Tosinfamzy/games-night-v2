import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { HostAuthzService } from '../host-authz.service';
import { HostOfMeta } from '../decorators/host-of.decorator';
import { SESSION_MEMBER_KEY } from '../decorators/session-member.decorator';

/**
 * Authorizes session-scoped reads: the caller must belong to the session (any
 * player) or be its host. A route opts in with @SessionMember; the check is
 * delegated to HostAuthzService. Routes without @SessionMember are untouched, so
 * this composes with HostGuard on the same controller (each no-ops unless its
 * own metadata is present).
 */
@Injectable()
export class SessionMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly hostAuthz: HostAuthzService,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const meta = this.reflector.get<HostOfMeta | undefined>(
      SESSION_MEMBER_KEY,
      context.getHandler(),
    );
    if (!meta) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    return this.hostAuthz.authorizeSessionMember(request, meta);
  }
}
