/**
 * Stable, machine-readable error codes returned in every error response.
 *
 * The frontend branches on `code` (not on human-readable messages), so these
 * values are a contract: rename with care. Domain-specific codes can be added
 * here and attached to a thrown exception via `{ code }` on its response body —
 * the global filter respects an explicit code and otherwise derives one from the
 * HTTP status (see `codeForStatus`).
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  HTTP_ERROR = 'HTTP_ERROR',

  // Domain-specific codes for the games-night flows the UI reacts to.
  EMAIL_TAKEN = 'EMAIL_TAKEN',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SESSION_INVALID_STATE = 'SESSION_INVALID_STATE',
  GAME_INVALID_STATE = 'GAME_INVALID_STATE',
  ROUND_NOT_ACTIVE = 'ROUND_NOT_ACTIVE',
}

const STATUS_TO_CODE: Readonly<Record<number, ErrorCode>> = {
  400: ErrorCode.BAD_REQUEST,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  422: ErrorCode.UNPROCESSABLE_ENTITY,
  429: ErrorCode.RATE_LIMITED,
  500: ErrorCode.INTERNAL_ERROR,
};

/** Map an HTTP status to a stable error code, falling back sensibly. */
export function codeForStatus(status: number): ErrorCode {
  return (
    STATUS_TO_CODE[status] ??
    (status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.HTTP_ERROR)
  );
}

/** The consistent error envelope returned for every failed HTTP request. */
export interface ErrorResponseBody {
  statusCode: number;
  code: ErrorCode | string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
}
