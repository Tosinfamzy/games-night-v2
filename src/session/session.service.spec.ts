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
import { AuthService } from '../auth/auth.service';
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
  MockSessionGateway,
  MockScoreService,
  MockAuthService,
  MockSessionReadinessService,
  MockSessionLifecycleService,
  MockSessionPlayerService,
  createMockSessionGateway,
  createMockScoreService,
  createMockAuthService,
  createMockSessionReadinessService,
  createMockSessionLifecycleService,
  createMockSessionPlayerService,
} from '../../test/utils/test-helpers';
import { SessionReadinessService } from './services/session-readiness.service';
import { SessionLifecycleService } from './services/session-lifecycle.service';
import { SessionPlayerService } from './services/session-player.service';
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
  let sessionGateway: MockSessionGateway;
  let scoreService: MockScoreService;
  let authService: MockAuthService;
  let sessionReadinessService: MockSessionReadinessService;
  let sessionLifecycleService: MockSessionLifecycleService;
  let sessionPlayerService: MockSessionPlayerService;

  beforeEach(async () => {
    sessionRepo = createMockRepository<Session>();
    gamesMasterRepo = createMockRepository<GamesMaster>();
    gameRepo = createMockRepository<Game>();
    gameLibraryRepo = createMockRepository<GameLibrary>();
    playerRepo = createMockRepository<Player>();
    teamRepo = createMockRepository<Team>();

    sessionGateway = createMockSessionGateway();
    scoreService = createMockScoreService();
    authService = createMockAuthService();
    sessionReadinessService = createMockSessionReadinessService();
    sessionLifecycleService = createMockSessionLifecycleService();
    sessionPlayerService = createMockSessionPlayerService();

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
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: SessionReadinessService,
          useValue: sessionReadinessService,
        },
        {
          provide: SessionLifecycleService,
          useValue: sessionLifecycleService,
        },
        {
          provide: SessionPlayerService,
          useValue: sessionPlayerService,
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
        const gamesMaster = createMockGamesMaster({
          id: 'gm-1',
          name: 'Test GM',
        });
        const mockJoinCode = '123456';
        const savedSession = createMockSession({
          id: 'session-1',
          joinCode: mockJoinCode,
          host: gamesMaster as GamesMaster,
        });
        const savedPlayer = createMockPlayer({
          id: 'player-1',
          name: 'Test GM',
          session: savedSession as Session,
        });

        (joinCodeUtil.generateJoinCode as jest.Mock).mockReturnValue(
          mockJoinCode,
        );
        gamesMasterRepo.findOneBy.mockResolvedValue(gamesMaster);
        sessionRepo.findOne.mockImplementation(({ where }) => {
          // Join code uniqueness check
          if (where?.joinCode) return Promise.resolve(null);
          // findOne by id for reload
          if (where?.id) return Promise.resolve(savedSession);
          return Promise.resolve(null);
        });
        sessionRepo.create.mockReturnValue(savedSession);
        sessionRepo.save.mockResolvedValue(savedSession);
        playerRepo.create.mockReturnValue(savedPlayer);
        playerRepo.save.mockResolvedValue(savedPlayer);
        authService.generatePlayerToken.mockReturnValue('mock-token');

        const result = await service.create({
          name: 'Test Session',
          date: new Date(),
          gamesMasterId: 'gm-1',
        });

        expect(result.session.joinCode).toBe(mockJoinCode);
        expect(joinCodeUtil.generateJoinCode).toHaveBeenCalledTimes(1);
      });

      it('should retry join code generation if collision occurs', async () => {
        const gamesMaster = createMockGamesMaster({
          id: 'gm-1',
          name: 'Test GM',
        });
        const existingSession = createMockSession({ joinCode: '111111' });
        const newSession = createMockSession({
          id: 'session-2',
          joinCode: '222222',
          host: gamesMaster as GamesMaster,
        });
        const savedPlayer = createMockPlayer({
          id: 'player-1',
          name: 'Test GM',
          session: newSession as Session,
        });

        (joinCodeUtil.generateJoinCode as jest.Mock)
          .mockReturnValueOnce('111111') // First try - collision
          .mockReturnValueOnce('222222'); // Second try - unique

        gamesMasterRepo.findOneBy.mockResolvedValue(gamesMaster);
        let findOneCallCount = 0;
        sessionRepo.findOne.mockImplementation(({ where }) => {
          if (where?.joinCode) {
            findOneCallCount++;
            if (findOneCallCount === 1) return Promise.resolve(existingSession); // Collision
            return Promise.resolve(null); // Unique
          }
          if (where?.id) return Promise.resolve(newSession);
          return Promise.resolve(null);
        });
        sessionRepo.create.mockReturnValue(newSession);
        sessionRepo.save.mockResolvedValue(newSession);
        playerRepo.create.mockReturnValue(savedPlayer);
        playerRepo.save.mockResolvedValue(savedPlayer);
        authService.generatePlayerToken.mockReturnValue('mock-token');

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

  describe('Player Management (delegated to SessionPlayerService)', () => {
    describe('joinSession', () => {
      it('should delegate to sessionPlayerService.joinSession', async () => {
        const mockPlayer = createMockPlayer({
          name: 'Alice',
          status: PlayerStatus.JOINED,
        });
        const mockResult = {
          player: mockPlayer,
          session: createMockSession({ id: 'session-1' }),
          playerToken: 'mock-token',
          isRejoin: false,
          message: 'Successfully joined',
        };

        sessionPlayerService.joinSession.mockResolvedValue(mockResult);

        const result = await service.joinSession({
          joinCode: '123456',
          playerName: 'Alice',
        });

        expect(sessionPlayerService.joinSession).toHaveBeenCalledWith(
          { joinCode: '123456', playerName: 'Alice' },
          undefined,
        );
        expect(result).toEqual(mockResult);
      });

      it('should pass userId to sessionPlayerService.joinSession', async () => {
        const mockPlayer = createMockPlayer({
          name: 'Auth Player',
          userId: 'user-123',
          isGuest: false,
        });
        const mockResult = {
          player: mockPlayer,
          session: createMockSession({ id: 'session-1' }),
          playerToken: 'mock-token',
          isRejoin: false,
          message: 'Successfully joined',
        };

        sessionPlayerService.joinSession.mockResolvedValue(mockResult);

        const result = await service.joinSession(
          { joinCode: '123456', playerName: 'Auth Player' },
          'user-123',
        );

        expect(sessionPlayerService.joinSession).toHaveBeenCalledWith(
          { joinCode: '123456', playerName: 'Auth Player' },
          'user-123',
        );
        expect(result.player.userId).toBe('user-123');
      });

      it('should propagate errors from sessionPlayerService', async () => {
        sessionPlayerService.joinSession.mockRejectedValue(
          new BadRequestException('Cannot join a completed session'),
        );

        await expect(
          service.joinSession({ joinCode: '123456', playerName: 'Bob' }),
        ).rejects.toThrow('Cannot join a completed session');
      });
    });

    describe('rejoinSession', () => {
      it('should delegate to sessionPlayerService.rejoinSession', async () => {
        const mockPlayer = createMockPlayer({
          id: 'player-1',
          name: 'Alice',
          status: PlayerStatus.JOINED,
        });
        const mockResult = {
          player: mockPlayer,
          session: createMockSession({ id: 'session-1' }),
          playerToken: 'new-mock-token',
          isRejoin: true,
        };

        sessionPlayerService.rejoinSession.mockResolvedValue(mockResult);

        const result = await service.rejoinSession('old-player-token');

        expect(sessionPlayerService.rejoinSession).toHaveBeenCalledWith(
          'old-player-token',
        );
        expect(result).toEqual(mockResult);
      });

      it('should propagate errors from sessionPlayerService', async () => {
        sessionPlayerService.rejoinSession.mockRejectedValue(
          new BadRequestException('Invalid or expired player token'),
        );

        await expect(service.rejoinSession('invalid-token')).rejects.toThrow(
          'Invalid or expired player token',
        );
      });
    });

    describe('setPlayerReady', () => {
      it('should delegate to sessionPlayerService.setPlayerReady', async () => {
        const mockPlayer = createMockPlayer({
          id: 'player-1',
          status: PlayerStatus.READY,
        });

        sessionPlayerService.setPlayerReady.mockResolvedValue(mockPlayer);

        const result = await service.setPlayerReady('session-1', 'player-1', true);

        expect(sessionPlayerService.setPlayerReady).toHaveBeenCalledWith(
          'session-1',
          'player-1',
          true,
        );
        expect(result).toEqual(mockPlayer);
      });

      it('should propagate errors from sessionPlayerService', async () => {
        sessionPlayerService.setPlayerReady.mockRejectedValue(
          new NotFoundException('Player with ID player-1 not found'),
        );

        await expect(
          service.setPlayerReady('session-1', 'player-1', true),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('updatePlayerStatus', () => {
      it('should delegate to sessionPlayerService.updatePlayerStatus', async () => {
        const mockPlayer = createMockPlayer({
          id: 'player-1',
          status: PlayerStatus.PLAYING,
        });

        sessionPlayerService.updatePlayerStatus.mockResolvedValue(mockPlayer);

        const result = await service.updatePlayerStatus(
          'session-1',
          'player-1',
          PlayerStatus.PLAYING,
        );

        expect(sessionPlayerService.updatePlayerStatus).toHaveBeenCalledWith(
          'session-1',
          'player-1',
          PlayerStatus.PLAYING,
        );
        expect(result).toEqual(mockPlayer);
      });
    });

    describe('getSessionPlayers', () => {
      it('should delegate to sessionPlayerService.getSessionPlayers', async () => {
        const mockPlayers = [
          createMockPlayer({ id: 'p1' }),
          createMockPlayer({ id: 'p2' }),
        ];

        sessionPlayerService.getSessionPlayers.mockResolvedValue(mockPlayers);

        const result = await service.getSessionPlayers('session-1');

        expect(sessionPlayerService.getSessionPlayers).toHaveBeenCalledWith(
          'session-1',
        );
        expect(result).toEqual(mockPlayers);
      });
    });

    describe('removePlayerFromSession', () => {
      it('should delegate to sessionPlayerService.removePlayerFromSession', async () => {
        sessionPlayerService.removePlayerFromSession.mockResolvedValue(undefined);

        await service.removePlayerFromSession('session-1', 'player-1');

        expect(sessionPlayerService.removePlayerFromSession).toHaveBeenCalledWith(
          'session-1',
          'player-1',
        );
      });

      it('should propagate errors from sessionPlayerService', async () => {
        sessionPlayerService.removePlayerFromSession.mockRejectedValue(
          new BadRequestException('Cannot remove players from a session in progress'),
        );

        await expect(
          service.removePlayerFromSession('session-1', 'player-1'),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('kickPlayer', () => {
      it('should delegate to sessionPlayerService.kickPlayer', async () => {
        const mockSession = createMockSession({ id: 'session-1' });

        sessionPlayerService.kickPlayer.mockResolvedValue(mockSession);

        const result = await service.kickPlayer('session-1', 'player-1');

        expect(sessionPlayerService.kickPlayer).toHaveBeenCalledWith(
          'session-1',
          'player-1',
        );
        expect(result).toEqual(mockSession);
      });

      it('should propagate errors from sessionPlayerService', async () => {
        sessionPlayerService.kickPlayer.mockRejectedValue(
          new BadRequestException('Cannot kick players from completed session'),
        );

        await expect(
          service.kickPlayer('session-1', 'player-1'),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('Readiness Rules (delegated to SessionReadinessService)', () => {
    describe('canStartSession', () => {
      it('should delegate to sessionReadinessService.canStartSession', async () => {
        const mockResult = {
          canStart: true,
          reasons: [],
          checks: {
            hasGames: true,
            playersReady: true,
            playerCountValid: true,
            sessionScheduled: true,
          },
        };

        sessionReadinessService.canStartSession.mockResolvedValue(mockResult);

        const result = await service.canStartSession('session-1');

        expect(sessionReadinessService.canStartSession).toHaveBeenCalledWith(
          'session-1',
        );
        expect(result).toEqual(mockResult);
      });

      it('should return canStart false when readinessService returns false', async () => {
        const mockResult = {
          canStart: false,
          reasons: ['Session must have at least one game selected'],
          checks: {
            hasGames: false,
            playersReady: false,
            playerCountValid: false,
            sessionScheduled: true,
          },
        };

        sessionReadinessService.canStartSession.mockResolvedValue(mockResult);

        const result = await service.canStartSession('session-1');

        expect(result.canStart).toBe(false);
        expect(result.reasons).toContain(
          'Session must have at least one game selected',
        );
      });
    });

    describe('validatePlayerCountForGames', () => {
      it('should delegate to sessionReadinessService.validatePlayerCountForGames', async () => {
        const mockResult = {
          isValid: true,
          errors: [],
          playerCount: 3,
          gameRequirements: [
            {
              gameName: 'Game 1',
              minPlayers: 2,
              maxPlayers: 4,
              isValidForCurrentPlayers: true,
            },
            {
              gameName: 'Game 2',
              minPlayers: 3,
              maxPlayers: 6,
              isValidForCurrentPlayers: true,
            },
          ],
        };

        sessionReadinessService.validatePlayerCountForGames.mockResolvedValue(
          mockResult,
        );

        const result = await service.validatePlayerCountForGames('session-1');

        expect(
          sessionReadinessService.validatePlayerCountForGames,
        ).toHaveBeenCalledWith('session-1');
        expect(result).toEqual(mockResult);
      });

      it('should return isValid false when readinessService returns invalid', async () => {
        const mockResult = {
          isValid: false,
          errors: [
            'Test Game requires 6-10 players, but 2 active players in session',
          ],
          playerCount: 2,
          gameRequirements: [
            {
              gameName: 'Test Game',
              minPlayers: 6,
              maxPlayers: 10,
              isValidForCurrentPlayers: false,
            },
          ],
        };

        sessionReadinessService.validatePlayerCountForGames.mockResolvedValue(
          mockResult,
        );

        const result = await service.validatePlayerCountForGames('session-1');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Test Game requires 6-10 players, but 2 active players in session',
        );
      });
    });
  });

  describe('Session Lifecycle (delegated to SessionLifecycleService)', () => {
    describe('startSession', () => {
      it('should delegate to sessionLifecycleService.startSession', async () => {
        const session = createMockSession({
          id: 'session-1',
          status: SessionStatus.IN_PROGRESS,
        });

        sessionLifecycleService.startSession.mockResolvedValue(session);

        const result = await service.startSession('session-1');

        expect(sessionLifecycleService.startSession).toHaveBeenCalledWith(
          'session-1',
        );
        expect(result).toEqual(session);
      });

      it('should propagate errors from sessionLifecycleService', async () => {
        sessionLifecycleService.startSession.mockRejectedValue(
          new BadRequestException('Cannot start session: No games selected'),
        );

        await expect(service.startSession('session-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('completeSession', () => {
      it('should delegate to sessionLifecycleService.completeSession', async () => {
        const session = createMockSession({
          id: 'session-1',
          status: SessionStatus.COMPLETED,
        });

        sessionLifecycleService.completeSession.mockResolvedValue(session);

        const result = await service.completeSession('session-1');

        expect(sessionLifecycleService.completeSession).toHaveBeenCalledWith(
          'session-1',
        );
        expect(result).toEqual(session);
      });

      it('should propagate errors from sessionLifecycleService', async () => {
        sessionLifecycleService.completeSession.mockRejectedValue(
          new BadRequestException(
            'Cannot complete session. 1 games are still in progress',
          ),
        );

        await expect(service.completeSession('session-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('cancelSession', () => {
      it('should delegate to sessionLifecycleService.cancelSession', async () => {
        const session = createMockSession({
          id: 'session-1',
          status: SessionStatus.CANCELLED,
        });

        sessionLifecycleService.cancelSession.mockResolvedValue(session);

        const result = await service.cancelSession('session-1');

        expect(sessionLifecycleService.cancelSession).toHaveBeenCalledWith(
          'session-1',
        );
        expect(result).toEqual(session);
      });

      it('should propagate errors from sessionLifecycleService', async () => {
        sessionLifecycleService.cancelSession.mockRejectedValue(
          new BadRequestException('Session cannot be cancelled'),
        );

        await expect(service.cancelSession('session-1')).rejects.toThrow(
          BadRequestException,
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
    it('should delegate to sessionReadinessService.getSessionReadiness', async () => {
      const mockReadinessResult = {
        sessionId: 'session-1',
        totalPlayers: 2,
        readyPlayers: 1,
        allReady: false,
        playersStatus: [
          {
            playerId: 'p1',
            playerName: 'ReadyPlayer',
            isReady: true,
            status: PlayerStatus.READY,
          },
          {
            playerId: 'p2',
            playerName: 'JoinedPlayer',
            isReady: false,
            status: PlayerStatus.JOINED,
          },
        ],
        session: {
          id: 'session-1',
          name: 'Test',
          status: SessionStatus.SCHEDULED,
          joinCode: '123456',
        },
        players: { total: 2, active: 2, ready: 1, joined: 1, playing: 0 },
        games: [],
        validation: {
          isValid: true,
          errors: [],
          playerCount: 2,
          gameRequirements: [],
        },
        readiness: {
          canStart: false,
          reasons: [],
          checks: {
            hasGames: false,
            playersReady: false,
            playerCountValid: true,
            sessionScheduled: true,
          },
        },
      };

      sessionReadinessService.getSessionReadiness.mockResolvedValue(
        mockReadinessResult,
      );

      const result = await service.getSessionReadiness('session-1');

      expect(sessionReadinessService.getSessionReadiness).toHaveBeenCalledWith(
        'session-1',
      );
      expect(result).toEqual(mockReadinessResult);
    });

    it('should return correct structure with top-level fields from readinessService', async () => {
      const mockReadinessResult = {
        sessionId: 'session-1',
        totalPlayers: 2,
        readyPlayers: 2,
        allReady: true,
        playersStatus: [],
        session: {
          id: 'session-1',
          name: 'Test',
          status: SessionStatus.SCHEDULED,
          joinCode: '123456',
        },
        players: { total: 2, active: 2, ready: 2, joined: 0, playing: 0 },
        games: [],
        validation: {
          isValid: true,
          errors: [],
          playerCount: 2,
          gameRequirements: [],
        },
        readiness: {
          canStart: true,
          reasons: [],
          checks: {
            hasGames: true,
            playersReady: true,
            playerCountValid: true,
            sessionScheduled: true,
          },
        },
      };

      sessionReadinessService.getSessionReadiness.mockResolvedValue(
        mockReadinessResult,
      );

      const result = await service.getSessionReadiness('session-1');

      expect(result.totalPlayers).toBe(2);
      expect(result.readyPlayers).toBe(2);
      expect(result.allReady).toBe(true);
    });

    it('should maintain backward compatibility with nested structure from readinessService', async () => {
      const mockReadinessResult = {
        sessionId: 'session-1',
        totalPlayers: 0,
        readyPlayers: 0,
        allReady: false,
        playersStatus: [],
        session: {
          id: 'session-1',
          name: 'Test Session',
          status: SessionStatus.SCHEDULED,
          joinCode: '123456',
        },
        players: { total: 0, active: 0, ready: 0, joined: 0, playing: 0 },
        games: [],
        validation: {
          isValid: true,
          errors: [],
          playerCount: 0,
          gameRequirements: [],
        },
        readiness: {
          canStart: false,
          reasons: [],
          checks: {
            hasGames: false,
            playersReady: false,
            playerCountValid: false,
            sessionScheduled: true,
          },
        },
      };

      sessionReadinessService.getSessionReadiness.mockResolvedValue(
        mockReadinessResult,
      );

      const result = await service.getSessionReadiness('session-1');

      expect(result).toHaveProperty('session');
      expect(result.session).toMatchObject({
        id: 'session-1',
        name: 'Test Session',
        status: SessionStatus.SCHEDULED,
        joinCode: '123456',
      });
      expect(result).toHaveProperty('players');
      expect(result).toHaveProperty('games');
      expect(result).toHaveProperty('validation');
      expect(result).toHaveProperty('readiness');
    });
  });
});
