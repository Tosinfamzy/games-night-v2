import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SessionReadinessService } from './session-readiness.service';
import { Session } from '../session.entity';
import { Player, PlayerStatus } from '../../player/player.entity';
import { Game } from '../../game/game.entity';
import { GameLibrary } from '../../game-library/game-library.entity';
import { SessionStatus } from '../enums/session-status.enum';
import { GameStatus } from '../../game/enums/game-status.enum';
import { createMockRepository } from '../../../test/utils/test-db';
import {
  createMockSession,
  createMockPlayer,
  createMockGame,
  createMockGameLibrary,
  resetTestCounters,
} from '../../../test/utils/test-helpers';

describe('SessionReadinessService', () => {
  let service: SessionReadinessService;
  let sessionRepo: ReturnType<typeof createMockRepository>;

  beforeEach(async () => {
    sessionRepo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionReadinessService,
        {
          provide: getRepositoryToken(Session),
          useValue: sessionRepo,
        },
      ],
    }).compile();

    service = module.get<SessionReadinessService>(SessionReadinessService);
    resetTestCounters();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePlayerCountForGames', () => {
    it('should return valid when player count is within all game requirements', async () => {
      const game1Library = createMockGameLibrary({
        name: 'Game 1',
        minPlayers: 2,
        maxPlayers: 4,
      });
      const game2Library = createMockGameLibrary({
        name: 'Game 2',
        minPlayers: 3,
        maxPlayers: 6,
      });
      const games = [
        createMockGame({ gameLibrary: game1Library as GameLibrary }),
        createMockGame({ gameLibrary: game2Library as GameLibrary }),
      ];
      const players = [
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.READY }),
      ];
      const session = createMockSession({
        id: 'session-1',
        games: games as Game[],
        players: players as Player[],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.validatePlayerCountForGames('session-1');

      expect(result.isValid).toBe(true);
      expect(result.playerCount).toBe(3);
      expect(result.gameRequirements).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when player count is below minimum for a game', async () => {
      const gameLibrary = createMockGameLibrary({
        name: 'Big Game',
        minPlayers: 6,
        maxPlayers: 10,
      });
      const game = createMockGame({
        gameLibrary: gameLibrary as GameLibrary,
      });
      const players = [
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.READY }),
      ];
      const session = createMockSession({
        id: 'session-1',
        games: [game as Game],
        players: players as Player[],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.validatePlayerCountForGames('session-1');

      expect(result.isValid).toBe(false);
      expect(result.playerCount).toBe(2);
      expect(result.errors).toContain(
        'Big Game requires 6-10 players, but 2 active players in session',
      );
    });

    it('should return invalid when player count exceeds maximum for a game', async () => {
      const gameLibrary = createMockGameLibrary({
        name: 'Small Game',
        minPlayers: 2,
        maxPlayers: 4,
      });
      const game = createMockGame({
        gameLibrary: gameLibrary as GameLibrary,
      });
      const players = [
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.READY }),
      ];
      const session = createMockSession({
        id: 'session-1',
        games: [game as Game],
        players: players as Player[],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.validatePlayerCountForGames('session-1');

      expect(result.isValid).toBe(false);
      expect(result.playerCount).toBe(6);
      expect(result.errors).toContain(
        'Small Game requires 2-4 players, but 6 active players in session',
      );
    });

    it('should exclude disconnected players from count', async () => {
      const gameLibrary = createMockGameLibrary({
        name: 'Game',
        minPlayers: 2,
        maxPlayers: 4,
      });
      const game = createMockGame({
        gameLibrary: gameLibrary as GameLibrary,
      });
      const players = [
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.DISCONNECTED }), // Should be excluded
      ];
      const session = createMockSession({
        id: 'session-1',
        games: [game as Game],
        players: players as Player[],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.validatePlayerCountForGames('session-1');

      expect(result.isValid).toBe(true);
      expect(result.playerCount).toBe(2); // Only 2 active players
    });

    it('should include game requirements details', async () => {
      const gameLibrary = createMockGameLibrary({
        name: 'Test Game',
        minPlayers: 3,
        maxPlayers: 5,
      });
      const game = createMockGame({
        gameLibrary: gameLibrary as GameLibrary,
      });
      const players = [
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.READY }),
      ];
      const session = createMockSession({
        id: 'session-1',
        games: [game as Game],
        players: players as Player[],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.validatePlayerCountForGames('session-1');

      expect(result.gameRequirements).toHaveLength(1);
      expect(result.gameRequirements[0]).toMatchObject({
        gameName: 'Test Game',
        minPlayers: 3,
        maxPlayers: 5,
        isValidForCurrentPlayers: true,
      });
    });
  });

  describe('canStartSession', () => {
    it('should allow starting when all conditions are met', async () => {
      const gameLibrary = createMockGameLibrary({
        minPlayers: 2,
        maxPlayers: 6,
      });
      const game = createMockGame({
        gameLibrary: gameLibrary as GameLibrary,
      });
      const players = [
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.READY }),
      ];
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
        games: [game as Game],
        players: players as Player[],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.canStartSession('session-1');

      expect(result.canStart).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.checks.hasGames).toBe(true);
      expect(result.checks.playersReady).toBe(true);
      expect(result.checks.playerCountValid).toBe(true);
      expect(result.checks.sessionScheduled).toBe(true);
    });

    it('should not allow starting if no games are selected', async () => {
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
        games: [],
        players: [createMockPlayer({ status: PlayerStatus.READY }) as Player],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.canStartSession('session-1');

      expect(result.canStart).toBe(false);
      expect(result.checks.hasGames).toBe(false);
      expect(result.reasons).toContain(
        'Session must have at least one game selected',
      );
    });

    it('should not allow starting if session is not scheduled', async () => {
      const gameLibrary = createMockGameLibrary({
        minPlayers: 2,
        maxPlayers: 6,
      });
      const game = createMockGame({
        gameLibrary: gameLibrary as GameLibrary,
      });
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.IN_PROGRESS, // Already in progress
        games: [game as Game],
        players: [createMockPlayer({ status: PlayerStatus.READY }) as Player],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.canStartSession('session-1');

      expect(result.canStart).toBe(false);
      expect(result.checks.sessionScheduled).toBe(false);
    });

    it('should not allow starting if not all players are ready', async () => {
      const gameLibrary = createMockGameLibrary({
        minPlayers: 2,
        maxPlayers: 6,
      });
      const game = createMockGame({
        gameLibrary: gameLibrary as GameLibrary,
      });
      const players = [
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.JOINED }), // Not ready
        createMockPlayer({ status: PlayerStatus.READY }),
      ];
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
        games: [game as Game],
        players: players as Player[],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.canStartSession('session-1');

      expect(result.canStart).toBe(false);
      expect(result.checks.playersReady).toBe(false);
      expect(result.reasons).toContain(
        'All players must be ready. Currently 2/3 players ready',
      );
    });

    it('should exclude disconnected players from ready check', async () => {
      const gameLibrary = createMockGameLibrary({
        minPlayers: 2,
        maxPlayers: 6,
      });
      const game = createMockGame({
        gameLibrary: gameLibrary as GameLibrary,
      });
      const players = [
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.DISCONNECTED }), // Ignored
      ];
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
        games: [game as Game],
        players: players as Player[],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.canStartSession('session-1');

      expect(result.canStart).toBe(true);
      expect(result.checks.playersReady).toBe(true);
    });

    it('should not allow starting if player count is invalid for games', async () => {
      const gameLibrary = createMockGameLibrary({
        name: 'Test Game',
        minPlayers: 4,
        maxPlayers: 8,
      });
      const game = createMockGame({
        gameLibrary: gameLibrary as GameLibrary,
      });
      const players = [
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.READY }),
      ]; // Only 2 players, need 4
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
        games: [game as Game],
        players: players as Player[],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.canStartSession('session-1');

      expect(result.canStart).toBe(false);
      expect(result.checks.playerCountValid).toBe(false);
      expect(result.reasons).toContain(
        'Test Game requires 4-8 players, but 2 active players in session',
      );
    });

    it('should not allow starting if no players exist', async () => {
      const gameLibrary = createMockGameLibrary({
        minPlayers: 2,
        maxPlayers: 6,
      });
      const game = createMockGame({
        gameLibrary: gameLibrary as GameLibrary,
      });
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
        games: [game as Game],
        players: [],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.canStartSession('session-1');

      expect(result.canStart).toBe(false);
      expect(result.checks.playersReady).toBe(false);
    });
  });

  describe('getSessionReadiness', () => {
    it('should return flattened structure with top-level fields', async () => {
      const gameLibrary = createMockGameLibrary({
        name: 'Test Game',
        minPlayers: 2,
        maxPlayers: 4,
      });
      const game = createMockGame({
        id: 'game-1',
        status: GameStatus.PENDING,
        gameLibrary: gameLibrary as GameLibrary,
      });

      const readyPlayer = createMockPlayer({
        id: 'p1',
        name: 'ReadyPlayer',
        status: PlayerStatus.READY,
      }) as Player;

      const joinedPlayer = createMockPlayer({
        id: 'p2',
        name: 'JoinedPlayer',
        status: PlayerStatus.JOINED,
      }) as Player;

      const session = createMockSession({
        id: 'session-1',
        name: 'Test Session',
        status: SessionStatus.SCHEDULED,
        joinCode: '123456',
        games: [game as Game],
        players: [readyPlayer, joinedPlayer],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.getSessionReadiness('session-1');

      // Top-level fields
      expect(result.sessionId).toBe('session-1');
      expect(result.totalPlayers).toBe(2);
      expect(result.readyPlayers).toBe(1);
      expect(result.allReady).toBe(false);
    });

    it('should include playersStatus array with correct details', async () => {
      const readyPlayer = createMockPlayer({
        id: 'p1',
        name: 'Alice',
        status: PlayerStatus.READY,
      }) as Player;

      const joinedPlayer = createMockPlayer({
        id: 'p2',
        name: 'Bob',
        status: PlayerStatus.JOINED,
      }) as Player;

      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
        games: [],
        players: [readyPlayer, joinedPlayer],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.getSessionReadiness('session-1');

      expect(result.playersStatus).toHaveLength(2);
      expect(result.playersStatus[0]).toMatchObject({
        playerId: 'p1',
        playerName: 'Alice',
        isReady: true,
        status: PlayerStatus.READY,
      });
      expect(result.playersStatus[1]).toMatchObject({
        playerId: 'p2',
        playerName: 'Bob',
        isReady: false,
        status: PlayerStatus.JOINED,
      });
    });

    it('should set allReady to true when all active players are ready', async () => {
      const player1 = createMockPlayer({
        status: PlayerStatus.READY,
      }) as Player;

      const player2 = createMockPlayer({
        status: PlayerStatus.READY,
      }) as Player;

      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
        games: [],
        players: [player1, player2],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.getSessionReadiness('session-1');

      expect(result.totalPlayers).toBe(2);
      expect(result.readyPlayers).toBe(2);
      expect(result.allReady).toBe(true);
    });

    it('should exclude disconnected players from playersStatus', async () => {
      const readyPlayer = createMockPlayer({
        status: PlayerStatus.READY,
      }) as Player;

      const disconnectedPlayer = createMockPlayer({
        status: PlayerStatus.DISCONNECTED,
      }) as Player;

      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
        games: [],
        players: [readyPlayer, disconnectedPlayer],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.getSessionReadiness('session-1');

      expect(result.totalPlayers).toBe(2); // Total includes disconnected
      expect(result.playersStatus).toHaveLength(1); // But playersStatus only shows active
      expect(result.allReady).toBe(true); // All ACTIVE players are ready
    });

    it('should maintain backward compatibility with nested structure', async () => {
      const gameLibrary = createMockGameLibrary({
        name: 'Test Game',
        minPlayers: 2,
        maxPlayers: 4,
      });
      const game = createMockGame({
        id: 'game-1',
        status: GameStatus.PENDING,
        gameLibrary: gameLibrary as GameLibrary,
      });

      const session = createMockSession({
        id: 'session-1',
        name: 'Test Session',
        status: SessionStatus.SCHEDULED,
        joinCode: '123456',
        games: [game as Game],
        players: [],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.getSessionReadiness('session-1');

      // Backward compatibility fields
      expect(result.session).toMatchObject({
        id: 'session-1',
        name: 'Test Session',
        status: SessionStatus.SCHEDULED,
        joinCode: '123456',
      });
      expect(result.players).toMatchObject({
        total: 0,
        active: 0,
        ready: 0,
        joined: 0,
        playing: 0,
      });
      expect(result.games).toHaveLength(1);
      expect(result.games[0]).toMatchObject({
        id: 'game-1',
        name: 'Test Game',
        minPlayers: 2,
        maxPlayers: 4,
        status: GameStatus.PENDING,
      });
      expect(result).toHaveProperty('validation');
      expect(result).toHaveProperty('readiness');
    });

    it('should include validation and readiness data', async () => {
      const gameLibrary = createMockGameLibrary({
        name: 'Test Game',
        minPlayers: 2,
        maxPlayers: 4,
      });
      const game = createMockGame({
        gameLibrary: gameLibrary as GameLibrary,
      });
      const players = [
        createMockPlayer({ status: PlayerStatus.READY }),
        createMockPlayer({ status: PlayerStatus.READY }),
      ];
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
        games: [game as Game],
        players: players as Player[],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.getSessionReadiness('session-1');

      // Validation data
      expect(result.validation).toMatchObject({
        isValid: true,
        errors: [],
        playerCount: 2,
      });

      // Readiness data
      expect(result.readiness).toMatchObject({
        canStart: true,
        reasons: [],
        checks: {
          hasGames: true,
          playersReady: true,
          playerCountValid: true,
          sessionScheduled: true,
        },
      });
    });
  });
});
