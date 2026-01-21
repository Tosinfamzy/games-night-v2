import { Test, TestingModule } from '@nestjs/testing';
import { GameTimerService } from './game-timer.service';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { TeamService } from '../team/team.service';
import { GameStatus } from './enums/game-status.enum';
import {
  createMockGame,
  createMockTeam,
  resetTestCounters,
  MockGameService,
  MockGameGateway,
  MockTeamService,
  createMockGameGateway,
  createMockTeamService,
} from '../../test/utils/test-helpers';

describe('GameTimerService', () => {
  let service: GameTimerService;
  let gameService: MockGameService;
  let gameGateway: MockGameGateway;
  let teamService: MockTeamService;
  let dateNowSpy: jest.SpyInstance;
  let currentTime: number;

  beforeEach(async () => {
    jest.useFakeTimers();

    // Mock Date.now() to return controlled time
    currentTime = new Date('2025-01-01T12:00:00.000Z').getTime();
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

    teamService = createMockTeamService();

    gameService = {
      nextTurn: jest.fn(),
      findOne: jest.fn(),
      startGame: jest.fn(),
      completeGame: jest.fn(),
      pauseGame: jest.fn(),
      resumeGame: jest.fn(),
    };

    gameGateway = createMockGameGateway();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameTimerService,
        {
          provide: GameService,
          useValue: gameService,
        },
        {
          provide: GameGateway,
          useValue: gameGateway,
        },
        {
          provide: TeamService,
          useValue: teamService,
        },
      ],
    }).compile();

    service = module.get<GameTimerService>(GameTimerService);
    resetTestCounters();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
    dateNowSpy.mockRestore();
    jest.useRealTimers();
    service.stopAllTimers();
  });

  describe('startTimer', () => {
    it('should start a timer and track it in activeTimers', () => {
      const gameId = 'game-1';
      const teamId = 'team-1';
      const teamName = 'Red Team';
      const turnTimeLimit = 60;
      const turnStartedAt = new Date(currentTime);

      service.startTimer(
        gameId,
        teamId,
        teamName,
        turnTimeLimit,
        turnStartedAt,
      );

      expect(service.getActiveTimerCount()).toBe(1);
    });

    it('should stop existing timer before starting new one for same game', () => {
      const gameId = 'game-1';
      const teamId1 = 'team-1';
      const teamId2 = 'team-2';
      const turnTimeLimit = 60;
      const turnStartedAt = new Date(currentTime);

      service.startTimer(
        gameId,
        teamId1,
        'Team 1',
        turnTimeLimit,
        turnStartedAt,
      );
      expect(service.getActiveTimerCount()).toBe(1);

      service.startTimer(
        gameId,
        teamId2,
        'Team 2',
        turnTimeLimit,
        new Date(currentTime),
      );
      expect(service.getActiveTimerCount()).toBe(1);
    });

    it('should allow multiple timers for different games', () => {
      const turnTimeLimit = 60;
      const turnStartedAt = new Date(currentTime);

      service.startTimer(
        'game-1',
        'team-1',
        'Team 1',
        turnTimeLimit,
        turnStartedAt,
      );
      service.startTimer(
        'game-2',
        'team-2',
        'Team 2',
        turnTimeLimit,
        turnStartedAt,
      );

      expect(service.getActiveTimerCount()).toBe(2);
    });
  });

  describe('stopTimer', () => {
    it('should stop an active timer', () => {
      const gameId = 'game-1';
      const turnTimeLimit = 60;
      const turnStartedAt = new Date(currentTime);

      service.startTimer(
        gameId,
        'team-1',
        'Team 1',
        turnTimeLimit,
        turnStartedAt,
      );
      expect(service.getActiveTimerCount()).toBe(1);

      service.stopTimer(gameId);
      expect(service.getActiveTimerCount()).toBe(0);
    });

    it('should not throw error when stopping non-existent timer', () => {
      expect(() => service.stopTimer('non-existent-game')).not.toThrow();
    });
  });

  describe('timer ticks', () => {
    it('should emit regular ticks every 5 seconds', () => {
      const gameId = 'game-1';
      const turnTimeLimit = 60;
      const turnStartedAt = new Date(currentTime);

      service.startTimer(
        gameId,
        'team-1',
        'Team 1',
        turnTimeLimit,
        turnStartedAt,
      );

      // Advance 5 seconds
      currentTime += 5000;
      jest.advanceTimersByTime(5000);

      expect(gameGateway.broadcastTimerTick).toHaveBeenCalledWith(
        gameId,
        55, // 60 - 5 = 55 seconds remaining
        false,
      );
    });

    it('should emit warning at 30 seconds remaining', () => {
      const gameId = 'game-1';
      const turnTimeLimit = 60;
      const turnStartedAt = new Date(currentTime); // Start now

      service.startTimer(
        gameId,
        'team-1',
        'Team 1',
        turnTimeLimit,
        turnStartedAt,
      );

      // Advance to 30 seconds (30 seconds remaining)
      currentTime += 30000;
      jest.advanceTimersByTime(30000);

      expect(gameGateway.broadcastTimerTick).toHaveBeenCalledWith(
        gameId,
        30,
        true, // isWarning
      );
    });

    it('should emit warning at 10 seconds remaining', () => {
      const gameId = 'game-1';
      const turnTimeLimit = 60;
      const turnStartedAt = new Date(currentTime); // Start now

      service.startTimer(
        gameId,
        'team-1',
        'Team 1',
        turnTimeLimit,
        turnStartedAt,
      );

      // Advance to 50 seconds (10 seconds remaining)
      currentTime += 50000;
      jest.advanceTimersByTime(50000);

      expect(gameGateway.broadcastTimerTick).toHaveBeenCalledWith(
        gameId,
        10,
        true, // isWarning
      );
    });

    it('should emit warning at 5 seconds remaining', () => {
      const gameId = 'game-1';
      const turnTimeLimit = 60;
      const turnStartedAt = new Date(currentTime); // Start now

      service.startTimer(
        gameId,
        'team-1',
        'Team 1',
        turnTimeLimit,
        turnStartedAt,
      );

      // Advance to 55 seconds (5 seconds remaining)
      currentTime += 55000;
      jest.advanceTimersByTime(55000);

      expect(gameGateway.broadcastTimerTick).toHaveBeenCalledWith(
        gameId,
        5,
        true, // isWarning
      );
    });

    it('should only emit each warning once', () => {
      const gameId = 'game-1';
      const turnTimeLimit = 60;
      const turnStartedAt = new Date(currentTime); // Start now

      service.startTimer(
        gameId,
        'team-1',
        'Team 1',
        turnTimeLimit,
        turnStartedAt,
      );

      // Advance to 30s warning
      currentTime += 30000;
      jest.advanceTimersByTime(30000); // At 30s remaining

      // Verify warning was emitted
      expect(gameGateway.broadcastTimerTick).toHaveBeenCalledWith(
        gameId,
        30,
        true,
      );

      gameGateway.broadcastTimerTick.mockClear();

      // Advance another second
      currentTime += 1000;
      jest.advanceTimersByTime(1000); // At 29s remaining

      // Should not emit another warning for 30s
      expect(gameGateway.broadcastTimerTick).not.toHaveBeenCalledWith(
        gameId,
        30,
        true,
      );
    });
  });

  describe('timer expiration', () => {
    it('should emit expired event when time runs out', async () => {
      const gameId = 'game-1';
      const teamId = 'team-1';
      const teamName = 'Red Team';
      const turnTimeLimit = 5;
      const turnStartedAt = new Date(currentTime);

      const game = createMockGame({
        id: gameId,
        status: GameStatus.IN_PROGRESS,
        currentTurnTeamId: 'team-2',
        turnStartedAt: new Date(),
        turnTimeLimit,
      });

      gameService.nextTurn.mockResolvedValue(game);

      service.startTimer(
        gameId,
        teamId,
        teamName,
        turnTimeLimit,
        turnStartedAt,
      );

      // Advance to expiration (5 seconds + 1 to trigger)
      currentTime += 6000;
      jest.advanceTimersByTime(6000);

      // Wait for async operations
      await Promise.resolve();

      expect(gameGateway.broadcastTimerExpired).toHaveBeenCalledWith(
        gameId,
        teamId,
        teamName,
        true, // willAutoAdvance
      );
    });

    it('should auto-advance turn when timer expires', async () => {
      const gameId = 'game-1';
      const teamId = 'team-1';
      const turnTimeLimit = 5;
      const turnStartedAt = new Date(currentTime);

      const game = createMockGame({
        id: gameId,
        status: GameStatus.IN_PROGRESS,
        currentTurnTeamId: 'team-2',
        turnStartedAt: new Date(),
        turnTimeLimit,
      });

      gameService.nextTurn.mockResolvedValue(game);

      service.startTimer(
        gameId,
        teamId,
        'Team 1',
        turnTimeLimit,
        turnStartedAt,
      );

      // Advance to expiration
      currentTime += 6000;
      jest.advanceTimersByTime(6000);

      // Wait for async operations
      await Promise.resolve();

      expect(gameService.nextTurn).toHaveBeenCalledWith(gameId);
    });

    it('should start new timer after auto-advance', async () => {
      const gameId = 'game-1';
      const teamId = 'team-1';
      const turnTimeLimit = 5;
      const turnStartedAt = new Date(currentTime);

      const nextTeam = createMockTeam({ id: 'team-2', name: 'Blue Team' });
      const game = createMockGame({
        id: gameId,
        status: GameStatus.IN_PROGRESS,
        currentTurnTeamId: 'team-2',
        turnStartedAt: new Date(currentTime),
        turnTimeLimit: 60,
      });

      gameService.nextTurn.mockResolvedValue(game);
      teamService.findByGame.mockResolvedValue([nextTeam]);

      service.startTimer(
        gameId,
        teamId,
        'Team 1',
        turnTimeLimit,
        turnStartedAt,
      );

      // Verify timer is active
      expect(service.getActiveTimerCount()).toBe(1);

      // Advance to expiration
      currentTime += 6000;
      jest.advanceTimersByTime(6000);

      // Wait for async operations
      await Promise.resolve();
      await Promise.resolve();

      // Timer should still be active (new timer for next team)
      expect(service.getActiveTimerCount()).toBe(1);
    });

    it('should stop timer when auto-advance fails', async () => {
      const gameId = 'game-1';
      const teamId = 'team-1';
      const turnTimeLimit = 5;
      const turnStartedAt = new Date(currentTime);

      gameService.nextTurn.mockRejectedValue(new Error('Auto-advance failed'));

      service.startTimer(
        gameId,
        teamId,
        'Team 1',
        turnTimeLimit,
        turnStartedAt,
      );

      // Advance to expiration
      currentTime += 6000;
      jest.advanceTimersByTime(6000);

      // Wait for async operations
      await Promise.resolve();

      // Timer should be stopped due to error
      expect(service.getActiveTimerCount()).toBe(0);
    });
  });

  describe('stopAllTimers', () => {
    it('should stop all active timers', () => {
      const turnTimeLimit = 60;
      const turnStartedAt = new Date(currentTime);

      service.startTimer(
        'game-1',
        'team-1',
        'Team 1',
        turnTimeLimit,
        turnStartedAt,
      );
      service.startTimer(
        'game-2',
        'team-2',
        'Team 2',
        turnTimeLimit,
        turnStartedAt,
      );
      service.startTimer(
        'game-3',
        'team-3',
        'Team 3',
        turnTimeLimit,
        turnStartedAt,
      );

      expect(service.getActiveTimerCount()).toBe(3);

      service.stopAllTimers();

      expect(service.getActiveTimerCount()).toBe(0);
    });
  });

  describe('getActiveTimerCount', () => {
    it('should return 0 when no timers are active', () => {
      expect(service.getActiveTimerCount()).toBe(0);
    });

    it('should return correct count of active timers', () => {
      const turnTimeLimit = 60;
      const turnStartedAt = new Date(currentTime);

      service.startTimer(
        'game-1',
        'team-1',
        'Team 1',
        turnTimeLimit,
        turnStartedAt,
      );
      expect(service.getActiveTimerCount()).toBe(1);

      service.startTimer(
        'game-2',
        'team-2',
        'Team 2',
        turnTimeLimit,
        turnStartedAt,
      );
      expect(service.getActiveTimerCount()).toBe(2);

      service.stopTimer('game-1');
      expect(service.getActiveTimerCount()).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle very short time limits (1 second)', async () => {
      const gameId = 'game-1';
      const turnTimeLimit = 1;
      const turnStartedAt = new Date(currentTime);

      const game = createMockGame({
        id: gameId,
        status: GameStatus.IN_PROGRESS,
        currentTurnTeamId: 'team-2',
      });

      gameService.nextTurn.mockResolvedValue(game);

      service.startTimer(
        gameId,
        'team-1',
        'Team 1',
        turnTimeLimit,
        turnStartedAt,
      );

      currentTime += 2000;
      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      expect(gameGateway.broadcastTimerExpired).toHaveBeenCalled();
    });

    it('should handle timers that start already expired', async () => {
      const gameId = 'game-1';
      const turnTimeLimit = 10;
      const turnStartedAt = new Date(currentTime - 15000); // Started 15s ago

      const game = createMockGame({
        id: gameId,
        status: GameStatus.IN_PROGRESS,
      });

      gameService.nextTurn.mockResolvedValue(game);

      service.startTimer(
        gameId,
        'team-1',
        'Team 1',
        turnTimeLimit,
        turnStartedAt,
      );

      currentTime += 1000;
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(gameGateway.broadcastTimerExpired).toHaveBeenCalled();
    });

    it('should handle multiple rapid timer starts for same game', () => {
      const gameId = 'game-1';
      const turnTimeLimit = 60;
      const turnStartedAt = new Date(currentTime);

      // Rapidly start timers for the same game
      service.startTimer(
        gameId,
        'team-1',
        'Team 1',
        turnTimeLimit,
        turnStartedAt,
      );
      service.startTimer(
        gameId,
        'team-2',
        'Team 2',
        turnTimeLimit,
        new Date(currentTime),
      );
      service.startTimer(
        gameId,
        'team-3',
        'Team 3',
        turnTimeLimit,
        new Date(currentTime),
      );

      // Should only have 1 timer (last one)
      expect(service.getActiveTimerCount()).toBe(1);
    });
  });
});
