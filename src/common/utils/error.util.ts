/** Safely extract a message from an unknown caught value. */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Safely extract the constructor/class name from an unknown caught value. */
export function getErrorName(error: unknown): string {
  return error instanceof Error ? error.constructor.name : 'Error';
}
