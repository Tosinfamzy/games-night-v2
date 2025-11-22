import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { User } from '../../user/user.entity';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any,
  ): TUser {
    // Allow request even if no token is provided
    // Just return null user if authentication fails
    if (err || !user) {
      return null as TUser;
    }
    return user;
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Always return true to allow the request
    // The user will be null if authentication fails
    return super.canActivate(context) as boolean | Promise<boolean> | Observable<boolean>;
  }
}
