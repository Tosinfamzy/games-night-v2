import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../user/user.entity';
import { createMockUser } from '../../../test/utils/test-helpers';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockExecutionContext = (user?: any): ExecutionContext => {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user,
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  describe('canActivate', () => {
    it('should return true when no roles are required', () => {
      const context = createMockExecutionContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when user has the required role', () => {
      const mockUser = createMockUser({
        id: 'user-1',
        role: UserRole.GAMES_MASTER,
      });
      const context = createMockExecutionContext(mockUser);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.GAMES_MASTER]);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when user has one of multiple required roles', () => {
      const mockUser = createMockUser({
        id: 'user-1',
        role: UserRole.PLAYER,
      });
      const context = createMockExecutionContext(mockUser);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.GAMES_MASTER, UserRole.PLAYER]);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      const context = createMockExecutionContext(undefined);
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.GAMES_MASTER]);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'User not authenticated',
      );
    });

    it('should throw ForbiddenException when user lacks required role', () => {
      const mockUser = createMockUser({
        id: 'user-1',
        role: UserRole.PLAYER,
      });
      const context = createMockExecutionContext(mockUser);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.GAMES_MASTER]);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'Insufficient permissions',
      );
    });
  });
});
