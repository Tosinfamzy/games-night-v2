import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    // Allow request even if no token is provided
    // Just return null user if authentication fails
    if (err || !user) {
      return null;
    }
    return user;
  }

  canActivate(context: ExecutionContext) {
    // Always return true to allow the request
    // The user will be null if authentication fails
    return super.canActivate(context) as any;
  }
}
