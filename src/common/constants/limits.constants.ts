/**
 * Application limits and thresholds
 */
export const LIMITS = {
  /** Maximum number of attempts to generate a unique join code */
  JOIN_CODE_MAX_ATTEMPTS: 10,

  /** Maximum number of teams allowed per game */
  MAX_TEAMS_PER_GAME: 8,

  /** Maximum message length in chat */
  MAX_MESSAGE_LENGTH: 1000,

  /** Maximum players per session */
  MAX_PLAYERS_PER_SESSION: 50,

  /** Maximum games per session */
  MAX_GAMES_PER_SESSION: 20,

  /** Chat messages pagination limit */
  CHAT_MESSAGES_PAGE_SIZE: 50,

  /** Minimum players required for a game */
  MIN_PLAYERS_PER_GAME: 2,

  /** Minimum teams required for team games */
  MIN_TEAMS_PER_GAME: 2,
} as const;
