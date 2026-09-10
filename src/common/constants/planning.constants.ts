/**
 * Night Builder planning defaults.
 */
export const PLANNING = {
  /** Preferred number of teams when nothing else forces a different count. */
  DEFAULT_TEAM_COUNT: 3,

  /**
   * Placement points awarded per game by finishing position: 1st, 2nd, 3rd, …
   * Display-only for now (shown in the run-of-show / cheat sheet); a game may
   * override with a flat winner bonus (see GameLibrary.winnerBonusPoints).
   */
  DEFAULT_PLACEMENT_POINTS: [3, 2, 1] as const,

  /** Fallback minutes for a game with no estimated duration. */
  FALLBACK_GAME_MINUTES: 10,
} as const;
