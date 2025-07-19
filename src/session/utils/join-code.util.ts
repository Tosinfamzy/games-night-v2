/**
 * Generate a random 6-digit join code
 */
export function generateJoinCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Check if a join code is valid format (6 digits)
 */
export function isValidJoinCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}
