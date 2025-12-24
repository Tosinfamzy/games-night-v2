import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SessionService } from './session.service';
import { Session } from './session.entity';
import { GamesMaster } from '../games-master/games-master.entity';
import { Game } from '../game/game.entity';
import { GameLibrary } from '../game-library/game-library.entity';
import { Player, PlayerStatus } from '../player/player.entity';
import { Team } from '../team/team.entity';
import { SessionGateway } from './session.gateway';
import { ScoreService } from '../score/score.service';
import { SessionStatus } from './enums/session-status.enum';
import { GameStatus } from '../game/enums/game-status.enum';
import { createMockRepository } from '../../test/utils/test-db';
import {
  createMockSession,
  createMockGamesMaster,
  createMockPlayer,
  createMockGame,
  createMockGameLibrary,
  resetTestCounters,
} from '../../test/utils/test-helpers';
import * as joinCodeUtil from './utils/join-code.util';

// Mock the join code utility
jest.mock('./utils/join-code.util');

describe('SessionService', () => {
  let service: SessionService;
  let sessionRepo: ReturnType<typeof createMockRepository>;
  let gamesMasterRepo: ReturnType<typeof createMockRepository>;
  let gameRepo: ReturnType<typeof createMockRepository>;
  let gameLibraryRepo: ReturnType<typeof createMockRepository>;
  let playerRepo: ReturnType<typeof createMockRepository>;
  let teamRepo: ReturnType<typeof createMockRepository>;
  let sessionGateway: any;
  let scoreService: any;

  beforeEach(async () => {
    sessionRepo = createMockRepository<Session>();
    gamesMasterRepo = createMockRepository<GamesMaster>();
    gameRepo = createMockRepository<Game>();
    gameLibraryRepo = createMockRepository<GameLibrary>();
    playerRepo = createMockRepository<Player>();
    teamRepo = createMockRepository<Team>();

    sessionGateway = {
      broadcastPlayerJoined: jest.fn(),
      broadcastSessionStatusChange: jest.fn(),
      broadcastTeamCreated: jest.fn(),
    };

    scoreService = {
      getSessionLeaderboard: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: getRepositoryToken(Session),
          useValue: sessionRepo,
        },
        {
          provide: getRepositoryToken(GamesMaster),
          useValue: gamesMasterRepo,
        },
        {
          provide: getRepositoryToken(Game),
          useValue: gameRepo,
        },
        {
          provide: getRepositoryToken(GameLibrary),
          useValue: gameLibraryRepo,
        },
        {
          provide: getRepositoryToken(Player),
          useValue: playerRepo,
        },
        {
          provide: getRepositoryToken(Team),
          useValue: teamRepo,
        },
        {
          provide: SessionGateway,
          useValue: sessionGateway,
        },
        {
          provide: ScoreService,
          useValue: scoreService,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    resetTestCounters();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Join Code Uniqueness', () => {
    describe('create', () => {
      it('should generate unique join code on first try', async () => {
        const gamesMaster = createMockGamesMaster({ id: 'gm-1' });
        const mockJoinCode = '123456';

        (joinCodeUtil.generateJoinCode as jest.Mock).mockReturnValue(
          mockJoinCode,
        );
        gamesMasterRepo.findOneBy.mockResolvedValue(gamesMaster);
        sessionRepo.findOne.mockResolvedValue(null); // Join code is unique
        sessionRepo.create.mockReturnValue(
          createMockSession({ joinCode: mockJoinCode }),
        );
        sessionRepo.save.mockResolvedValue(
          createMockSession({ joinCode: mockJoinCode }),
        );

        const result = await service.create({
          name: 'Test Session',
          date: new Date(),
          gamesMasterId: 'gm-1',
        });

        expect(result.session.joinCode).toBe(mockJoinCode);
        expect(joinCodeUtil.generateJoinCode).toHaveBeenCalledTimes(1);
      });

      it('should retry join code generation if collision occurs', async () => {
        const gamesMaster = createMockGamesMaster({ id: 'gm-1' });
        const existingSession = createMockSession({ joinCode: '111111' });

        (joinCodeUtil.generateJoinCode as jest.Mock)
          .mockReturnValueOnce('111111') // First try - collision
          .mockReturnValueOnce('222222'); // Second try - unique

        gamesMasterRepo.findOneBy.mockResolvedValue(gamesMaster);
        sessionRepo.findOne
          .mockResolvedValueOnce(existingSession) // Collision
          .mockResolvedValueOnce(null); // Unique
        sessionRepo.create.mockReturnValue(
          createMockSession({ joinCode: '222222' }),
        );
        sessionRepo.save.mockResolvedValue(
          createMockSession({ joinCode: '222222' }),
        );

        const result = await service.create({
          name: 'Test Session',
          date: new Date(),
          gamesMasterId: 'gm-1',
        });

        expect(result.session.joinCode).toBe('222222');
        expect(joinCodeUtil.generateJoinCode).toHaveBeenCalledTimes(2);
      });

      it('should throw error after max retries for join code generation', async () => {
        const gamesMaster = createMockGamesMaster({ id: 'gm-1' });
        const existingSession = createMockSession();

        (joinCodeUtil.generateJoinCode as jest.Mock).mockReturnValue('111111');
        gamesMasterRepo.findOneBy.mockResolvedValue(gamesMaster);
        sessionRepo.findOne.mockResolvedValue(existingSession); // Always collision

        await expect(
          service.create({
            name: 'Test Session',
            date: new Date(),
            gamesMasterId: 'gm-1',
          }),
        ).rejects.toThrow('Failed to generate unique join code');
      });

      it('should throw NotFoundException if GamesMaster not found', async () => {
        gamesMasterRepo.findOneBy.mockResolvedValue(null);

        await expect(
          service.create({
            name: 'Test Session',
            date: new Date(),
            gamesMasterId: 'invalid-gm',
          }),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('Player Validation', () => {
    describe('joinSession', () => {
      it('should allow player to join with unique name', async () => {
        const gamesMaster = createMockGamesMaster({ name: 'Test GM' });
        const session = createMockSession({
          id: 'session-1',
          joinCode: '123456',
          status: SessionStatus.SCHEDULED,
          host: gamesMaster as GamesMaster,
        });
        const mockPlayer = createMockPlayer({
          name: 'Alice',
          session: session as Session,
        });

        sessionRepo.findOne
          .mockResolvedValueOnce(session) // findByJoinCode
          .mockResolvedValueOnce(session); // Reload session
        playerRepo.findOne.mockResolvedValue(null); // Name is unique
        playerRepo.create.mockReturnValue(mockPlayer);
        playerRepo.save.mockResolvedValue(mockPlayer);

        const result = await service.joinSession({
          joinCode: '123456',
          playerName: 'Alice',
        });

        expect(result.player.name).toBe('Alice');
        expect(result.player.status).toBe(PlayerStatus.JOINED);
        expect(sessionGateway.broadcastPlayerJoined).toHaveBeenCalledWith(
          'session-1',
          mockPlayer,
        );
      });

      it('should mark player as guest if no userId provided', async () => {
        const gamesMaster = createMockGamesMaster({ name: 'Test GM' });
        const session = createMockSession({
          joinCode: '123456',
          status: SessionStatus.SCHEDULED,
          host: gamesMaster as GamesMaster,
        });
        const mockPlayer = createMockPlayer({
          name: 'Guest Player',
          isGuest: true,
        });

        sessionRepo.findOne.mockResolvedValue(session);
        playerRepo.findOne.mockResolvedValue(null);
        playerRepo.create.mockReturnValue(mockPlayer);
        playerRepo.save.mockResolvedValue(mockPlayer);

        const result = await service.joinSession({
          joinCode: '123456',
          playerName: 'Guest Player',
        });

        expect(result.player.isGuest).toBe(true);
      });

      it('should link player to userId if authenticated', async () => {
        const gamesMaster = createMockGamesMaster({ name: 'Test GM' });
        const session = createMockSession({
          joinCode: '123456',
          status: SessionStatus.SCHEDULED,
          host: gamesMaster as GamesMaster,
        });
        const mockPlayer = createMockPlayer({
          name: 'Auth Player',
          userId: 'user-123',
          isGuest: false,
        });

        sessionRepo.findOne.mockResolvedValue(session);
        playerRepo.findOne.mockResolvedValue(null);
        playerRepo.create.mockReturnValue(mockPlayer);
        playerRepo.save.mockResolvedValue(mockPlayer);

        const result = await service.joinSession(
          {
            joinCode: '123456',
            playerName: 'Auth Player',
          },
          'user-123',
        );

        expect(result.player.userId).toBe('user-123');
        expect(result.player.isGuest).toBe(false);
      });

      it('should throw BadRequestException if player name already exists', async () => {
        const session = createMockSession({
          id: 'session-1',
          joinCode: '123456',
          status: SessionStatus.SCHEDULED,
        });
        const existingPlayer = createMockPlayer({
          name: 'Alice',
          session: session as Session,
        });

        sessionRepo.findOne.mockResolvedValue(session);
        playerRepo.findOne.mockResolvedValue(existingPlayer);

        await expect(
          service.joinSession({
            joinCode: '123456',
            playerName: 'Alice',
          }),
        ).rejects.toThrow(
          'Player name "Alice" is already taken in this session',
        );
      });

      it('should throw BadRequestException if session is completed', async () => {
        const session = createMockSession({
          joinCode: '123456',
          status: SessionStatus.COMPLETED,
        });

        sessionRepo.findOne.mockResolvedValue(session);

        await expect(
          service.joinSession({
            joinCode: '123456',
            playerName: 'Bob',
          }),
        ).rejects.toThrow('Cannot join a completed session');
      });

      it('should throw BadRequestException if session is cancelled', async () => {
        const session = createMockSession({
          joinCode: '123456',
          status: SessionStatus.CANCELLED,
        });

        sessionRepo.findOne.mockResolvedValue(session);

        await expect(
          service.joinSession({
            joinCode: '123456',
            playerName: 'Charlie',
          }),
        ).rejects.toThrow('Cannot join a cancelled session');
      });

      it('should throw BadRequestException if session is in progress', async () => {
        const session = createMockSession({
          joinCode: '123456',
          status: SessionStatus.IN_PROGRESS,
        });

        sessionRepo.findOne.mockResolvedValue(session);

        await expect(
          service.joinSession({
            joinCode: '123456',
            playerName: 'David',
          }),
        ).rejects.toThrow('Cannot join session');
      });

      it('should throw NotFoundException if join code invalid', async () => {
        sessionRepo.findOne.mockResolvedValue(null);

        await expect(
          service.joinSession({
            joinCode: '999999',
            playerName: 'Eve',
          }),
        ).rejects.toThrow('Session with join code 999999 not found');
      });
    });
  });

  describe('Readiness Rules', () => {
    describe('canStartSession', () => {
      it('should allow starting when all conditions met', async () => {
        const gameLibrary = createMockGameLibrary({
          minPlayers: 2,
          maxPlayers: 6,
        });
        const game = createMockGame({
          gameLibrary: gameLibrary as GameLibrary,
        });
        const players = [
          createMockPlayer({
            id: 'p1',
            status: PlayerStatus.READY,
          }),
          createMockPlayer({
            id: 'p2',
            status: PlayerStatus.READY,
          }),
          createMockPlayer({
            id: 'p3',
            status: PlayerStatus.READY,
          }),
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

      it('should not allow starting if no games', async () => {
        const session = createMockSession({
          status: SessionStatus.SCHEDULED,
          games: [],
          players: [createMockPlayer({ status: PlayerStatus.READY }) as Player],
        });

        sessionRepo.findOne.mockResolvedValue(session);

        const result = await service.canStartSession('session-1');

        expect(result.canStart).toBe(false);
        expect(result.reasons).toContain(
          'Session must have at least one game selected',
        );
        expect(result.checks.hasGames).toBe(false);
      });

      it('should not allow starting if session not scheduled', async () => {
        const gameLibrary = createMockGameLibrary({
          minPlayers: 2,
          maxPlayers: 6,
        });
        const game = createMockGame({
          gameLibrary: gameLibrary as GameLibrary,
        });
        const session = createMockSession({
          status: SessionStatus.IN_PROGRESS,
          games: [game as Game],
          players: [createMockPlayer({ status: PlayerStatus.READY }) as Player],
        });

        sessionRepo.findOne.mockResolvedValue(session);

        const result = await service.canStartSession('session-1');

        expect(result.canStart).toBe(false);
        expect(result.checks.sessionScheduled).toBe(false);
      });

      it('should not allow starting if not all players ready', async () => {
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

      it('should exclude disconnected players from ready count', async () => {
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
          status: SessionStatus.SCHEDULED,
          games: [game as Game],
          players: players as Player[],
        });

        sessionRepo.findOne.mockResolvedValue(session);

        const result = await service.canStartSession('session-1');

        expect(result.canStart).toBe(true);
        expect(result.checks.playersReady).toBe(true);
      });

      it('should not allow starting if player count invalid for game', async () => {
        const gameLibrary = createMockGameLibrary({
          minPlayers: 4,
          maxPlayers: 8,
          name: 'Test Game',
        });
        const game = createMockGame({
          gameLibrary: gameLibrary as GameLibrary,
        });
        const players = [
          createMockPlayer({ status: PlayerStatus.READY }),
          createMockPlayer({ status: PlayerStatus.READY }),
        ]; // Only 2 players, need 4
        const session = createMockSession({
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

      it('should not allow starting if no players', async () => {
        const gameLibrary = createMockGameLibrary({
          minPlayers: 2,
          maxPlayers: 6,
        });
        const game = createMockGame({
          gameLibrary: gameLibrary as GameLibrary,
        });
        const session = createMockSession({
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

    describe('validatePlayerCountForGames', () => {
      it('should validate player count for multiple games', async () => {
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

      it('should detect invalid player count', async () => {
        const gameLibrary = createMockGameLibrary({
          name: 'Test Game',
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
          games: [game as Game],
          players: players as Player[],
        });

        sessionRepo.findOne.mockResolvedValue(session);

        const result = await service.validatePlayerCountForGames('session-1');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Test Game requires 6-10 players, but 2 active players in session',
        );
      });
    });
  });

  describe('Session Lifecycle', () => {
    describe('startSession', () => {
      it('should start session and update player statuses', async () => {
        const players = [
          createMockPlayer({ id: 'p1', status: PlayerStatus.READY }),
          createMockPlayer({ id: 'p2', status: PlayerStatus.READY }),
        ];
        const gameLibrary = createMockGameLibrary({
          minPlayers: 2,
          maxPlayers: 4,
        });
        const game = createMockGame({
          gameLibrary: gameLibrary as GameLibrary,
        });
        const session = createMockSession({
          id: 'session-1',
          status: SessionStatus.SCHEDULED,
          games: [game as Game],
          players: players as Player[],
        });

        sessionRepo.findOne.mockResolvedValue(session);
        sessionRepo.save.mockResolvedValue({
          ...session,
          status: SessionStatus.IN_PROGRESS,
        });
        playerRepo.save.mockResolvedValue({} as any);

        const result = await service.startSession('session-1');

        expect(result.status).toBe(SessionStatus.IN_PROGRESS);
        expect(
          sessionGateway.broadcastSessionStatusChange,
        ).toHaveBeenCalledWith(
          'session-1',
          SessionStatus.IN_PROGRESS,
          expect.any(Object),
        );
      });

      it('should throw BadRequestException if cannot start', async () => {
        const session = createMockSession({
          status: SessionStatus.SCHEDULED,
          games: [], // No games
          players: [],
        });

        sessionRepo.findOne.mockResolvedValue(session);

        await expect(service.startSession('session-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('completeSession', () => {
      it('should complete session when all games finished', async () => {
        const games = [
          createMockGame({ status: GameStatus.COMPLETED }),
          createMockGame({ status: GameStatus.COMPLETED }),
        ];
        const session = createMockSession({
          id: 'session-1',
          status: SessionStatus.IN_PROGRESS,
          games: games as Game[],
        });

        sessionRepo.findOne.mockResolvedValue(session);
        sessionRepo.save.mockResolvedValue({
          ...session,
          status: SessionStatus.COMPLETED,
        });

        const result = await service.completeSession('session-1');

        expect(result.status).toBe(SessionStatus.COMPLETED);
      });

      it('should throw BadRequestException if games still in progress', async () => {
        const games = [
          createMockGame({ status: GameStatus.COMPLETED }),
          createMockGame({ status: GameStatus.IN_PROGRESS }), // Still active
        ];
        const session = createMockSession({
          status: SessionStatus.IN_PROGRESS,
          games: games as Game[],
        });

        sessionRepo.findOne.mockResolvedValue(session);

        await expect(service.completeSession('session-1')).rejects.toThrow(
          'Cannot complete session. 1 games are still in progress',
        );
      });

      it('should throw BadRequestException if session not in progress', async () => {
        const session = createMockSession({
          status: SessionStatus.SCHEDULED,
        });

        sessionRepo.findOne.mockResolvedValue(session);

        await expect(service.completeSession('session-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('cancelSession', () => {
      it('should cancel session and all active games', async () => {
        const games = [
          createMockGame({ id: 'g1', status: GameStatus.IN_PROGRESS }),
          createMockGame({ id: 'g2', status: GameStatus.PENDING }),
          createMockGame({ id: 'g3', status: GameStatus.COMPLETED }), // Already completed
        ];
        const session = createMockSession({
          id: 'session-1',
          status: SessionStatus.IN_PROGRESS,
          games: games as Game[],
        });

        sessionRepo.findOne.mockResolvedValue(session);
        gameRepo.save.mockResolvedValue({} as any);
        sessionRepo.save.mockResolvedValue({
          ...session,
          status: SessionStatus.CANCELLED,
        });

        const result = await service.cancelSession('session-1');

        expect(result.status).toBe(SessionStatus.CANCELLED);
        expect(gameRepo.save).toHaveBeenCalledTimes(2); // Only active games
      });

      it('should throw BadRequestException if session already completed', async () => {
        const session = createMockSession({
          status: SessionStatus.COMPLETED,
        });

        sessionRepo.findOne.mockResolvedValue(session);

        await expect(service.cancelSession('session-1')).rejects.toThrow(
          'Session cannot be cancelled',
        );
      });
    });
  });

  describe('findOne', () => {
    it('should find a session by id', async () => {
      const session = createMockSession({ id: 'session-1' });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.findOne('session-1');

      expect(result).toEqual(session);
    });

    it('should throw NotFoundException if session not found', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSessionReadiness', () => {
    it('should return flattened readiness structure with top-level totalPlayers and readyPlayers', async () => {
      // Arrange - Create a session with 2 players (1 ready, 1 joined)
      const gamesMaster = createMockGamesMaster();
      const gameLibrary = createMockGameLibrary();
      const session = createMockSession(gamesMaster) as Session;
      session.status = SessionStatus.SCHEDULED;

      const readyPlayer = createMockPlayer({
        status: PlayerStatus.READY,
        name: 'ReadyPlayer',
        session,
      }) as Player;

      const joinedPlayer = createMockPlayer({
        status: PlayerStatus.JOINED,
        name: 'JoinedPlayer',
        session,
      }) as Player;

      session.players = [readyPlayer, joinedPlayer];
      session.games = [];

      sessionRepo.findOne.mockResolvedValue(session);

      // Act
      const result = await service.getSessionReadiness(session.id);

      // Assert - Bug #2 fix: Verify top-level fields exist
      expect(result).toHaveProperty('sessionId', session.id);
      expect(result).toHaveProperty('totalPlayers', 2);
      expect(result).toHaveProperty('readyPlayers', 1);
      expect(result).toHaveProperty('allReady', false);
      expect(result).toHaveProperty('playersStatus');

      // Verify playersStatus array
      expect(result.playersStatus).toHaveLength(2);
      expect(result.playersStatus[0]).toMatchObject({
        playerId: readyPlayer.id,
        playerName: 'ReadyPlayer',
        isReady: true,
        status: PlayerStatus.READY,
      });
      expect(result.playersStatus[1]).toMatchObject({
        playerId: joinedPlayer.id,
        playerName: 'JoinedPlayer',
        isReady: false,
        status: PlayerStatus.JOINED,
      });
    });

    it('should set allReady to true when all active players are ready', async () => {
      // Arrange
      const gamesMaster = createMockGamesMaster();
      const session = createMockSession(gamesMaster) as Session;

      const player1 = createMockPlayer({
        status: PlayerStatus.READY,
        session,
      }) as Player;

      const player2 = createMockPlayer({
        status: PlayerStatus.READY,
        session,
      }) as Player;

      session.players = [player1, player2];
      session.games = [];

      sessionRepo.findOne.mockResolvedValue(session);

      // Act
      const result = await service.getSessionReadiness(session.id);

      // Assert
      expect(result.totalPlayers).toBe(2);
      expect(result.readyPlayers).toBe(2);
      expect(result.allReady).toBe(true);
    });

    it('should exclude disconnected players from active player count', async () => {
      // Arrange
      const gamesMaster = createMockGamesMaster();
      const session = createMockSession(gamesMaster) as Session;

      const readyPlayer = createMockPlayer({
        status: PlayerStatus.READY,
        session,
      }) as Player;

      const disconnectedPlayer = createMockPlayer({
        status: PlayerStatus.DISCONNECTED,
        session,
      }) as Player;

      session.players = [readyPlayer, disconnectedPlayer];
      session.games = [];

      sessionRepo.findOne.mockResolvedValue(session);

      // Act
      const result = await service.getSessionReadiness(session.id);

      // Assert
      expect(result.totalPlayers).toBe(2); // Total includes disconnected
      expect(result.playersStatus).toHaveLength(1); // But playersStatus only shows active
      expect(result.allReady).toBe(true); // All ACTIVE players are ready
    });

    it('should maintain backward compatibility with nested structure', async () => {
      // Arrange
      const gamesMaster = createMockGamesMaster();
      const session = createMockSession(gamesMaster) as Session;
      session.players = [];
      session.games = [];

      sessionRepo.findOne.mockResolvedValue(session);

      // Act
      const result = await service.getSessionReadiness(session.id);

      // Assert - Verify backward compatibility fields still exist
      expect(result).toHaveProperty('session');
      expect(result.session).toMatchObject({
        id: session.id,
        name: session.name,
        status: session.status,
        joinCode: session.joinCode,
      });
      expect(result).toHaveProperty('players');
      expect(result).toHaveProperty('games');
      expect(result).toHaveProperty('validation');
      expect(result).toHaveProperty('readiness');
    });
  });
});
