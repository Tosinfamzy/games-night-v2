/**
 * Generate a random 6-digit join code
 */
export function generateJoinCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
