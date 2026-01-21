import { User, UserRole } from '../../src/user/user.entity';
import { GamesMaster } from '../../src/games-master/games-master.entity';
import { Session } from '../../src/session/session.entity';
import { SessionStatus } from '../../src/session/enums/session-status.enum';
import { Player, PlayerStatus } from '../../src/player/player.entity';
import { Team } from '../../src/team/team.entity';
import { Game } from '../../src/game/game.entity';
import { GameStatus } from '../../src/game/enums/game-status.enum';
import { Score } from '../../src/score/score.entity';
import { GameLibrary } from '../../src/game-library/game-library.entity';
import * as bcrypt from 'bcrypt';

/**
 * Mock Service Types
 * Use these types instead of 'any' for service mocks in tests
 */

export interface MockSessionGateway {
  broadcastPlayerJoined: jest.Mock;
  broadcastSessionStatusChange: jest.Mock;
  broadcastTeamCreated: jest.Mock;
  broadcastTeamUpdated: jest.Mock;
  broadcastTeamDeleted: jest.Mock;
  broadcastPlayerAssignedToTeam: jest.Mock;
  broadcastPlayerReadiness: jest.Mock;
  broadcastSessionReadiness: jest.Mock;
  server: {
    to: jest.Mock;
  };
}

export interface MockScoreService {
  getSessionLeaderboard: jest.Mock;
  getRankedGameScores: jest.Mock;
  getGameScores: jest.Mock;
  createScore: jest.Mock;
  updateScore: jest.Mock;
  deleteScore: jest.Mock;
}

export interface MockGameService {
  findOne: jest.Mock;
  nextTurn: jest.Mock;
  startGame: jest.Mock;
  completeGame: jest.Mock;
  pauseGame: jest.Mock;
  resumeGame: jest.Mock;
}

export interface MockGameGateway {
  broadcastTimerTick: jest.Mock;
  broadcastTimerExpired: jest.Mock;
  broadcastTurnStarted: jest.Mock;
  broadcastTurnAdvanced: jest.Mock;
  broadcastGameStarted: jest.Mock;
  broadcastGameCompleted: jest.Mock;
}

export interface MockTeamService {
  findByGame: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  getTeamStats: jest.Mock;
}

export interface MockUserService {
  findByEmail: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
}

export interface MockJwtService {
  sign: jest.Mock;
  verify: jest.Mock;
}

export interface MockConfigService {
  get: jest.Mock;
}

export interface MockGamesMasterService {
  create: jest.Mock;
  findOne: jest.Mock;
}

export interface MockAuthService {
  generatePlayerToken: jest.Mock;
  validatePlayerToken: jest.Mock;
}

export interface MockSessionReadinessService {
  validatePlayerCountForGames: jest.Mock;
  canStartSession: jest.Mock;
  getSessionReadiness: jest.Mock;
}

export interface MockSessionLifecycleService {
  startSession: jest.Mock;
  completeSession: jest.Mock;
  cancelSession: jest.Mock;
}

export interface MockSessionPlayerService {
  joinSession: jest.Mock;
  rejoinSession: jest.Mock;
  setPlayerReady: jest.Mock;
  updatePlayerStatus: jest.Mock;
  getSessionPlayers: jest.Mock;
  removePlayerFromSession: jest.Mock;
  kickPlayer: jest.Mock;
}

export interface MockTeamFormationService {
  createTeamsForGame: jest.Mock;
  clearTeamsForGame: jest.Mock;
  suggestTeamFormation: jest.Mock;
  assignPlayersByStrategy: jest.Mock;
  validateTeamFormation: jest.Mock;
}

export interface MockTeamAssignmentService {
  manualAssignPlayers: jest.Mock;
  rebalanceTeams: jest.Mock;
  shufflePlayers: jest.Mock;
  swapPlayerToTeam: jest.Mock;
  dissolveTeam: jest.Mock;
  reassignPlayer: jest.Mock;
}

export interface MockGameStatsService {
  getGameStats: jest.Mock;
  getResults: jest.Mock;
  getTimerStatus: jest.Mock;
}

/**
 * Factory functions for creating typed mock services
 */

export const createMockSessionGateway = (): MockSessionGateway => ({
  broadcastPlayerJoined: jest.fn(),
  broadcastSessionStatusChange: jest.fn(),
  broadcastTeamCreated: jest.fn(),
  broadcastTeamUpdated: jest.fn(),
  broadcastTeamDeleted: jest.fn(),
  broadcastPlayerAssignedToTeam: jest.fn(),
  broadcastPlayerReadiness: jest.fn(),
  broadcastSessionReadiness: jest.fn(),
  server: {
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  },
});

export const createMockScoreService = (): MockScoreService => ({
  getSessionLeaderboard: jest.fn(),
  getRankedGameScores: jest.fn(),
  getGameScores: jest.fn(),
  createScore: jest.fn(),
  updateScore: jest.fn(),
  deleteScore: jest.fn(),
});

export const createMockGameService = (): MockGameService => ({
  findOne: jest.fn(),
  nextTurn: jest.fn(),
  startGame: jest.fn(),
  completeGame: jest.fn(),
  pauseGame: jest.fn(),
  resumeGame: jest.fn(),
});

export const createMockGameGateway = (): MockGameGateway => ({
  broadcastTimerTick: jest.fn(),
  broadcastTimerExpired: jest.fn(),
  broadcastTurnStarted: jest.fn(),
  broadcastTurnAdvanced: jest.fn(),
  broadcastGameStarted: jest.fn(),
  broadcastGameCompleted: jest.fn(),
});

export const createMockTeamService = (): MockTeamService => ({
  findByGame: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getTeamStats: jest.fn(),
});

export const createMockUserService = (): MockUserService => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
});

export const createMockJwtService = (): MockJwtService => ({
  sign: jest.fn(),
  verify: jest.fn(),
});

export const createMockConfigService = (): MockConfigService => ({
  get: jest.fn(),
});

export const createMockGamesMasterService = (): MockGamesMasterService => ({
  create: jest.fn(),
  findOne: jest.fn(),
});

export const createMockAuthService = (): MockAuthService => ({
  generatePlayerToken: jest.fn(),
  validatePlayerToken: jest.fn(),
});

export const createMockSessionReadinessService =
  (): MockSessionReadinessService => ({
    validatePlayerCountForGames: jest.fn(),
    canStartSession: jest.fn(),
    getSessionReadiness: jest.fn(),
  });

export const createMockSessionLifecycleService =
  (): MockSessionLifecycleService => ({
    startSession: jest.fn(),
    completeSession: jest.fn(),
    cancelSession: jest.fn(),
  });

export const createMockSessionPlayerService = (): MockSessionPlayerService => ({
  joinSession: jest.fn(),
  rejoinSession: jest.fn(),
  setPlayerReady: jest.fn(),
  updatePlayerStatus: jest.fn(),
  getSessionPlayers: jest.fn(),
  removePlayerFromSession: jest.fn(),
  kickPlayer: jest.fn(),
});

export const createMockTeamFormationService = (): MockTeamFormationService => ({
  createTeamsForGame: jest.fn(),
  clearTeamsForGame: jest.fn(),
  suggestTeamFormation: jest.fn(),
  assignPlayersByStrategy: jest.fn(),
  validateTeamFormation: jest.fn(),
});

export const createMockTeamAssignmentService =
  (): MockTeamAssignmentService => ({
    manualAssignPlayers: jest.fn(),
    rebalanceTeams: jest.fn(),
    shufflePlayers: jest.fn(),
    swapPlayerToTeam: jest.fn(),
    dissolveTeam: jest.fn(),
    reassignPlayer: jest.fn(),
  });

export const createMockGameStatsService = (): MockGameStatsService => ({
  getGameStats: jest.fn(),
  getResults: jest.fn(),
  getTimerStatus: jest.fn(),
});

/**
 * Test data factories for creating mock entities
 * These helpers generate realistic test data with sensible defaults
 */

let userCounter = 0;
let sessionCounter = 0;
let playerCounter = 0;
let teamCounter = 0;
let gameCounter = 0;

/**
 * Create a mock User entity
 */
export const createMockUser = (
  overrides: Partial<User> = {},
): Partial<User> => {
  userCounter++;
  return {
    id: overrides.id || `user-${userCounter}`,
    email: overrides.email || `user${userCounter}@example.com`,
    password: overrides.password || bcrypt.hashSync('password123', 10),
    name: overrides.name || `Test User ${userCounter}`,
    role: overrides.role || UserRole.PLAYER,
    avatarUrl: overrides.avatarUrl,
    isEmailVerified: overrides.isEmailVerified ?? false,
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
    gamesMasterProfile: overrides.gamesMasterProfile,
    playerProfile: overrides.playerProfile,
    ...overrides,
  };
};

/**
 * Create a mock GamesMaster entity
 */
export const createMockGamesMaster = (
  overrides: Partial<GamesMaster> = {},
): Partial<GamesMaster> => {
  const id = overrides.id || `gm-${Date.now()}`;
  return {
    id,
    name: overrides.name || 'Test Games Master',
    userId: overrides.userId,
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
    sessions: overrides.sessions || [],
    ...overrides,
  };
};

/**
 * Create a mock Session entity
 */
export const createMockSession = (
  overrides: Partial<Session> = {},
): Partial<Session> => {
  sessionCounter++;
  const joinCode =
    overrides.joinCode || String(Math.floor(100000 + Math.random() * 900000));

  return {
    id: overrides.id || `session-${sessionCounter}`,
    name: overrides.name || `Test Session ${sessionCounter}`,
    description: overrides.description || 'A test game session',
    date: overrides.date || new Date(),
    location: overrides.location || 'Test Location',
    status: overrides.status || SessionStatus.SCHEDULED,
    joinCode,
    host: overrides.host as GamesMaster,
    games: overrides.games || [],
    teams: overrides.teams || [],
    players: overrides.players || [],
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
    ...overrides,
  };
};

/**
 * Create a mock Player entity
 */
export const createMockPlayer = (
  overrides: Partial<Player> = {},
): Partial<Player> => {
  playerCounter++;
  return {
    id: overrides.id || `player-${playerCounter}`,
    name: overrides.name || `Player ${playerCounter}`,
    isGuest: overrides.isGuest ?? true,
    userId: overrides.userId,
    status: overrides.status || PlayerStatus.JOINED,
    lastConnectedAt: overrides.lastConnectedAt,
    session: overrides.session as Session,
    teams: overrides.teams || [],
    scores: overrides.scores || [],
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
    ...overrides,
  };
};

/**
 * Create a mock Team entity
 */
export const createMockTeam = (
  overrides: Partial<Team> = {},
): Partial<Team> => {
  teamCounter++;
  return {
    id: overrides.id || `team-${teamCounter}`,
    name: overrides.name || `Team ${teamCounter}`,
    color:
      overrides.color ||
      `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    position: overrides.position ?? teamCounter,
    isActive: overrides.isActive ?? true,
    game: overrides.game as Game,
    session: overrides.session as Session,
    players: overrides.players || [],
    scores: overrides.scores || [],
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
    ...overrides,
  };
};

/**
 * Create a mock Game entity
 */
export const createMockGame = (
  overrides: Partial<Game> = {},
): Partial<Game> => {
  gameCounter++;
  return {
    id: overrides.id || `game-${gameCounter}`,
    name: overrides.name || `Test Game ${gameCounter}`,
    status: overrides.status || GameStatus.PENDING,
    currentRound: overrides.currentRound ?? 0,
    maxRounds: overrides.maxRounds ?? 3,
    currentTurnTeamId: overrides.currentTurnTeamId,
    turnStartedAt: overrides.turnStartedAt,
    turnTimeLimit: overrides.turnTimeLimit,
    winnerId: overrides.winnerId,
    completedAt: overrides.completedAt,
    results: overrides.results,
    session: overrides.session as Session,
    gameLibrary: overrides.gameLibrary as GameLibrary,
    teams: overrides.teams || [],
    scores: overrides.scores || [],
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
    ...overrides,
  };
};

/**
 * Create a mock Score entity
 */
export const createMockScore = (
  overrides: Partial<Score> = {},
): Partial<Score> => {
  return {
    id: overrides.id || `score-${Date.now()}-${Math.random()}`,
    points: overrides.points ?? 10,
    isBonus: overrides.isBonus ?? false,
    roundNumber: overrides.roundNumber ?? 1,
    game: overrides.game as Game,
    player: overrides.player as Player,
    team: overrides.team as Team,
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
    ...overrides,
  };
};

/**
 * Create a mock GameLibrary entity
 */
export const createMockGameLibrary = (
  overrides: Partial<GameLibrary> = {},
): Partial<GameLibrary> => {
  return {
    id: overrides.id || `game-lib-${Date.now()}`,
    name: overrides.name || 'Test Board Game',
    description:
      overrides.description || 'A fun test game for testing purposes',
    minPlayers: overrides.minPlayers ?? 2,
    maxPlayers: overrides.maxPlayers ?? 6,
    estimatedDuration: overrides.estimatedDuration ?? 30,
    difficulty: overrides.difficulty || 'Easy',
    categories: overrides.categories || ['Test', 'Party Game'],
    equipment: overrides.equipment || 'Cards, Dice',
    rules: overrides.rules || 'Test game rules',
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
    ...overrides,
  };
};

/**
 * Reset all counters (useful between test files)
 */
export const resetTestCounters = (): void => {
  userCounter = 0;
  sessionCounter = 0;
  playerCounter = 0;
  teamCounter = 0;
  gameCounter = 0;
};

/**
 * Create a complete test scenario with all related entities
 * Useful for integration tests
 */
export const createCompleteTestScenario = () => {
  const gamesMaster = createMockGamesMaster();
  const user = createMockUser({
    role: UserRole.GAMES_MASTER,
    gamesMasterProfile: gamesMaster as GamesMaster,
  });

  const session = createMockSession({
    host: gamesMaster as GamesMaster,
  });

  const gameLibrary = createMockGameLibrary();

  const game = createMockGame({
    session: session as Session,
    gameLibrary: gameLibrary as GameLibrary,
  });

  const player1 = createMockPlayer({ session: session as Session });
  const player2 = createMockPlayer({ session: session as Session });

  const team1 = createMockTeam({
    session: session as Session,
    game: game as Game,
    players: [player1 as Player],
  });

  const team2 = createMockTeam({
    session: session as Session,
    game: game as Game,
    players: [player2 as Player],
  });

  const score1 = createMockScore({
    game: game as Game,
    team: team1 as Team,
    player: player1 as Player,
    points: 10,
  });

  const score2 = createMockScore({
    game: game as Game,
    team: team2 as Team,
    player: player2 as Player,
    points: 15,
  });

  return {
    user,
    gamesMaster,
    session,
    gameLibrary,
    game,
    players: [player1, player2],
    teams: [team1, team2],
    scores: [score1, score2],
  };
};
