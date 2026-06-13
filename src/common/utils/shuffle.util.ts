/**
 * Return a new array with its elements randomly shuffled using the
 * Fisher-Yates algorithm (uniform distribution).
 *
 * Replaces `[...arr].sort(() => Math.random() - 0.5)`, which is a biased
 * shuffle (comparator is not a consistent ordering).
 */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
