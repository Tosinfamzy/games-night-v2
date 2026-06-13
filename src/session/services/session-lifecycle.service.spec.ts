import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { SessionLifecycleService } from './session-lifecycle.service';
import { SessionReadinessService } from './session-readiness.service';
import { Session } from '../session.entity';
import { Game } from '../../game/game.entity';
import { Player, PlayerStatus } from '../../player/player.entity';
import { SessionStatus } from '../enums/session-status.enum';
import { GameStatus } from '../../game/enums/game-status.enum';
import { SessionGateway } from '../session.gateway';
import { createMockRepository } from '../../../test/utils/test-db';
import {
  createMockSession,
  createMockPlayer,
  createMockGame,
  createMockGameLibrary,
  resetTestCounters,
  MockSessionGateway,
  MockSessionReadinessService,
  createMockSessionGateway,
  createMockSessionReadinessService,
} from '../../../test/utils/test-helpers';
import { GameLibrary } from '../../game-library/game-library.entity';

describe('SessionLifecycleService', () => {
  let service: SessionLifecycleService;
  let sessionRepo: ReturnType<typeof createMockRepository>;
  let gameRepo: ReturnType<typeof createMockRepository>;
  let playerRepo: ReturnType<typeof createMockRepository>;
  let sessionGateway: MockSessionGateway;
  let readinessService: MockSessionReadinessService;

  beforeEach(async () => {
    sessionRepo = createMockRepository();
    gameRepo = createMockRepository();
    playerRepo = createMockRepository();
    sessionGateway = createMockSessionGateway();
    readinessService = createMockSessionReadinessService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionLifecycleService,
        {
          provide: getRepositoryToken(Session),
          useValue: sessionRepo,
        },
        {
          provide: getRepositoryToken(Game),
          useValue: gameRepo,
        },
        {
          provide: getRepositoryToken(Player),
          useValue: playerRepo,
        },
        {
          provide: SessionGateway,
          useValue: sessionGateway,
        },
        {
          provide: SessionReadinessService,
          useValue: readinessService,
        },
      ],
    }).compile();

    service = module.get<SessionLifecycleService>(SessionLifecycleService);
    resetTestCounters();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startSession', () => {
    it('should start session when all conditions are met', async () => {
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

      readinessService.canStartSession.mockResolvedValue({
        canStart: true,
        reasons: [],
        checks: {
          hasGames: true,
          playersReady: true,
          playerCountValid: true,
          sessionScheduled: true,
        },
      });

      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockResolvedValue({
        ...session,
        status: SessionStatus.IN_PROGRESS,
      });
      playerRepo.save.mockResolvedValue({} as any);

      const result = await service.startSession('session-1');

      expect(result.status).toBe(SessionStatus.IN_PROGRESS);
      expect(sessionGateway.broadcastSessionStatusChange).toHaveBeenCalledWith(
        'session-1',
        SessionStatus.IN_PROGRESS,
        expect.any(Object),
      );
    });

    it('should update ready players to playing status', async () => {
      const players = [
        createMockPlayer({ id: 'p1', status: PlayerStatus.READY }),
        createMockPlayer({ id: 'p2', status: PlayerStatus.READY }),
        createMockPlayer({ id: 'p3', status: PlayerStatus.DISCONNECTED }), // Should be ignored
      ];
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
        players: players as Player[],
      });

      readinessService.canStartSession.mockResolvedValue({
        canStart: true,
        reasons: [],
        checks: {
          hasGames: true,
          playersReady: true,
          playerCountValid: true,
          sessionScheduled: true,
        },
      });

      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockResolvedValue({
        ...session,
        status: SessionStatus.IN_PROGRESS,
      });
      playerRepo.save.mockResolvedValue({} as any);

      await service.startSession('session-1');

      // Should save 2 players (p1 and p2), not the disconnected one
      expect(playerRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException if cannot start', async () => {
      readinessService.canStartSession.mockResolvedValue({
        canStart: false,
        reasons: [
          'Session must have at least one game selected',
          'All players must be ready',
        ],
        checks: {
          hasGames: false,
          playersReady: false,
          playerCountValid: false,
          sessionScheduled: true,
        },
      });

      await expect(service.startSession('session-1')).rejects.toThrow(
        'Cannot start session: Session must have at least one game selected, All players must be ready',
      );
    });

    it('should throw BadRequestException if session not found', async () => {
      readinessService.canStartSession.mockResolvedValue({
        canStart: true,
        reasons: [],
        checks: {
          hasGames: true,
          playersReady: true,
          playerCountValid: true,
          sessionScheduled: true,
        },
      });

      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.startSession('non-existent')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('completeSession', () => {
    it('should complete session when all games are finished', async () => {
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
      expect(sessionGateway.broadcastSessionStatusChange).toHaveBeenCalledWith(
        'session-1',
        SessionStatus.COMPLETED,
        expect.any(Object),
      );
    });

    it('should accept cancelled games as finished', async () => {
      const games = [
        createMockGame({ status: GameStatus.COMPLETED }),
        createMockGame({ status: GameStatus.CANCELLED }),
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
        createMockGame({ status: GameStatus.IN_PROGRESS }),
      ];
      const session = createMockSession({
        status: SessionStatus.IN_PROGRESS,
        games: games as Game[],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      await expect(service.completeSession('session-1')).rejects.toThrow(
        'Cannot complete session. 1 games are still in progress.',
      );
    });

    it('should throw BadRequestException if session not in progress', async () => {
      const session = createMockSession({
        status: SessionStatus.SCHEDULED,
      });

      sessionRepo.findOne.mockResolvedValue(session);

      await expect(service.completeSession('session-1')).rejects.toThrow(
        'Session cannot be completed. Current status: SCHEDULED',
      );
    });

    it('should throw BadRequestException if session already completed', async () => {
      const session = createMockSession({
        status: SessionStatus.COMPLETED,
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
        createMockGame({ id: 'g3', status: GameStatus.COMPLETED }), // Already completed, should be ignored
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
      expect(gameRepo.save).toHaveBeenCalledTimes(2); // Only g1 and g2
      expect(sessionGateway.broadcastSessionStatusChange).toHaveBeenCalledWith(
        'session-1',
        SessionStatus.CANCELLED,
        expect.any(Object),
      );
    });

    it('should cancel session with no games', async () => {
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
        games: [],
      });

      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockResolvedValue({
        ...session,
        status: SessionStatus.CANCELLED,
      });

      const result = await service.cancelSession('session-1');

      expect(result.status).toBe(SessionStatus.CANCELLED);
      expect(gameRepo.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if session already completed', async () => {
      const session = createMockSession({
        status: SessionStatus.COMPLETED,
      });

      sessionRepo.findOne.mockResolvedValue(session);

      await expect(service.cancelSession('session-1')).rejects.toThrow(
        'Session cannot be cancelled. Current status: COMPLETED',
      );
    });

    it('should throw BadRequestException if session already cancelled', async () => {
      const session = createMockSession({
        status: SessionStatus.CANCELLED,
      });

      sessionRepo.findOne.mockResolvedValue(session);

      await expect(service.cancelSession('session-1')).rejects.toThrow(
        'Session cannot be cancelled. Current status: CANCELLED',
      );
    });

    it('should throw BadRequestException if session not found', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.cancelSession('non-existent')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
