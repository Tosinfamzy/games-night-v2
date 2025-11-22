import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const result = super.canActivate(context);

    // Handle Promise
    if (result instanceof Promise) {
      return result.catch(() => true);
    }

    // Handle Observable
    if (result instanceof Observable) {
      return result.pipe(catchError(() => of(true)));
    }

    // Handle boolean
    return result;
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    // Return user if authenticated, null otherwise (no exception thrown)
    // We intentionally ignore err as we allow authentication to fail
    void err;
    return user || (null as TUser);
  }
}
