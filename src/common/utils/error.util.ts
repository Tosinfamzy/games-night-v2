/** Safely extract a message from an unknown caught value. */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Safely extract the constructor/class name from an unknown caught value. */
export function getErrorName(error: unknown): string {
  return error instanceof Error ? error.constructor.name : 'Error';
}

/**
 * True when a caught error is a Postgres unique-constraint violation (SQLSTATE
 * 23505). TypeORM surfaces the pg code either directly on the QueryFailedError
 * or on its nested `driverError`.
 */
export function isUniqueViolation(error: unknown): boolean {
  const code = error as { code?: string; driverError?: { code?: string } };
  return code?.code === '23505' || code?.driverError?.code === '23505';
}
