/**
 * How a game is scored:
 * - TEAM: points and turns belong to teams (the default, original behaviour).
 * - INDIVIDUAL: points and turns belong to individual players, so a 1-v-1 game
 *   doesn't require building two one-person teams.
 */
export enum ScoreMode {
  TEAM = 'team',
  INDIVIDUAL = 'individual',
}
