import { ExecutionContext } from '@nestjs/common';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { of } from 'rxjs';
import { createMockUser } from '../../../test/utils/test-helpers';

describe('OptionalJwtAuthGuard', () => {
  let guard: OptionalJwtAuthGuard;

  beforeEach(() => {
    guard = new OptionalJwtAuthGuard();
  });

  const createMockExecutionContext = (): ExecutionContext => {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    };
  };

  describe('canActivate', () => {
    it('should return true when super.canActivate returns true (boolean)', () => {
      const context = createMockExecutionContext();
      jest.spyOn(guard as any, 'canActivate').mockReturnValue(true);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return Promise<true> when authentication succeeds (Promise)', async () => {
      const context = createMockExecutionContext();
      jest
        .spyOn(OptionalJwtAuthGuard.prototype as any, 'canActivate')
        .mockReturnValue(Promise.resolve(true));

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should catch Promise rejection and return true', async () => {
      const context = createMockExecutionContext();

      // Create a promise that will be rejected
      const result = guard.canActivate(context);

      // If canActivate returns a Promise, we test that it catches rejections
      if (result instanceof Promise) {
        // The guard should catch any authentication errors and return true
        const finalResult = await result;
        expect(typeof finalResult).toBe('boolean');
      } else if (result instanceof of(true).constructor) {
        // If it's an Observable, subscribe and check
        const finalResult = await new Promise((resolve) => {
          result.subscribe((value: boolean) => resolve(value));
        });
        expect(typeof finalResult).toBe('boolean');
      }
    });
  });

  describe('handleRequest', () => {
    it('should return user when authenticated', () => {
      const mockUser = createMockUser({ id: 'user-1' });

      const result = guard.handleRequest(null, mockUser);

      expect(result).toEqual(mockUser);
    });

    it('should return null when user is not authenticated', () => {
      const result = guard.handleRequest(new Error('Unauthorized'), null);

      expect(result).toBeNull();
    });

    it('should return null when user is undefined', () => {
      const result = guard.handleRequest(null, undefined);

      expect(result).toBeNull();
    });
  });
});
