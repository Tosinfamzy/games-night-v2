/**
 * Time-related constants
 * All values in seconds unless otherwise specified
 */
export const TIME = {
  /** Player token expiry in seconds (24 hours) */
  PLAYER_TOKEN_EXPIRY_SECONDS: 86400,

  /** Games Master token expiry in seconds (7 days) */
  GM_TOKEN_EXPIRY_SECONDS: 604800,

  /** Refresh token expiry in seconds (30 days) */
  REFRESH_TOKEN_EXPIRY_SECONDS: 2592000,

  /** Timer warning thresholds in seconds */
  TIMER_WARNING_THRESHOLDS: [30, 10, 5] as const,

  /** Timer tick interval in milliseconds */
  TIMER_TICK_INTERVAL_MS: 1000,

  /** Regular timer tick broadcast interval in seconds (to reduce noise) */
  TIMER_BROADCAST_INTERVAL_SECONDS: 5,
} as const;

/**
 * Time multipliers for parsing duration strings
 */
export const TIME_MULTIPLIERS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};
