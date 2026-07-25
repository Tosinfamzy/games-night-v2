import { HttpStatus } from '@nestjs/common';
import { DomainError } from './domain-errors';
import { ErrorCode } from './error-code.enum';

/**
 * These codes are a contract the frontend branches on — lock them so a rename
 * can't silently break the UI.
 */
describe('DomainError', () => {
  it('emailTaken -> 409 EMAIL_TAKEN', () => {
    const e = DomainError.emailTaken();
    expect(e.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(e.getResponse()).toMatchObject({
      code: ErrorCode.EMAIL_TAKEN,
      message: 'Email already exists',
    });
  });

  it.each([
    ['invalidToken', ErrorCode.TOKEN_INVALID],
    ['sessionInvalidState', ErrorCode.SESSION_INVALID_STATE],
    ['gameInvalidState', ErrorCode.GAME_INVALID_STATE],
    ['roundNotActive', ErrorCode.ROUND_NOT_ACTIVE],
  ] as const)('%s -> 400 %s, preserving the message', (factory, code) => {
    const e = DomainError[factory]('specific reason');
    expect(e.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(e.message).toBe('specific reason');
    expect(e.getResponse()).toMatchObject({ code, message: 'specific reason' });
  });
});
