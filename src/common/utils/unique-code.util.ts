/**
 * Generate a code that is unique according to `exists`, retrying on collision.
 *
 * Returns the first code for which `exists` resolves false, or `null` if no
 * unique code was found within `maxAttempts`. Callers decide how to handle
 * exhaustion (e.g. throw a domain-appropriate exception).
 */
export async function generateUniqueCode(
  generate: () => string,
  exists: (code: string) => Promise<boolean>,
  maxAttempts: number,
): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generate();
    if (!(await exists(code))) {
      return code;
    }
  }
  return null;
}
