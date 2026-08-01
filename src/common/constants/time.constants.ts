/**
 * Time-related constants
 * All values in seconds unless otherwise specified
 */
export const TIME = {
  /** Player token expiry in seconds (24 hours) */
  PLAYER_TOKEN_EXPIRY_SECONDS: 86400,

  /** Timer warning thresholds in seconds */
  TIMER_WARNING_THRESHOLDS: [30, 10, 5] as const,

  /** Timer tick interval in milliseconds */
  TIMER_TICK_INTERVAL_MS: 1000,

  /** Regular timer tick broadcast interval in seconds (to reduce noise) */
  TIMER_BROADCAST_INTERVAL_SECONDS: 5,

  /**
   * Grace period before a disconnected player is broadcast as offline. Phones
   * at a party lock/background constantly, dropping the socket for a few
   * seconds; without this every lock flickers the player "disconnected" in
   * everyone's roster. A reconnect within the window cancels the offline.
   */
  PLAYER_OFFLINE_GRACE_MS: 20000,
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
