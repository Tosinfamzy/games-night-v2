import { BadRequestException, ConflictException } from '@nestjs/common';
import { ErrorCode } from './error-code.enum';

/**
 * Factories for domain errors that carry a stable `code` the frontend reacts to.
 *
 * The global exception filter reads `{ message, code }` off the thrown
 * exception, so these stay ordinary NestJS exceptions (correct status, message
 * preserved) while adding a machine-readable code for specific games-night flows.
 */
export const DomainError = {
  /** Signup/registration with an address that already exists. */
  emailTaken: (): ConflictException =>
    new ConflictException({
      message: 'Email already exists',
      code: ErrorCode.EMAIL_TAKEN,
    }),

  /** A player token is missing, malformed, expired, or for another session. */
  invalidToken: (message: string): BadRequestException =>
    new BadRequestException({ message, code: ErrorCode.TOKEN_INVALID }),

  /** A session lifecycle action isn't valid for its current status. */
  sessionInvalidState: (message: string): BadRequestException =>
    new BadRequestException({ message, code: ErrorCode.SESSION_INVALID_STATE }),

  /** A game action isn't valid for its current status. */
  gameInvalidState: (message: string): BadRequestException =>
    new BadRequestException({ message, code: ErrorCode.GAME_INVALID_STATE }),

  /** Scoring attempted while no round is in progress. */
  roundNotActive: (message: string): BadRequestException =>
    new BadRequestException({ message, code: ErrorCode.ROUND_NOT_ACTIVE }),
};
