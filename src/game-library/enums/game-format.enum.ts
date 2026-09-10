/**
 * How a game is physically run on the night. Drives the Night Builder's team
 * suggestions and how the run-of-show describes each game.
 *
 * - `free_for_all` — everyone plays as individuals, no teams (e.g. Musical Cups, UNO).
 * - `all_teams`     — every team competes at the same time (the common case).
 * - `round_robin`   — a 2-team game played as pairings A-B, B-C, A-C.
 * - `trio`          — each team fields a small group (e.g. the Blind/Deaf/Mute finale).
 */
export enum GameFormat {
  FREE_FOR_ALL = 'free_for_all',
  ALL_TEAMS = 'all_teams',
  ROUND_ROBIN = 'round_robin',
  TRIO = 'trio',
}
