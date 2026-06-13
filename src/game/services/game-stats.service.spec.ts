import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GameStatsService } from './game-stats.service';
import { Game } from '../game.entity';
import { TeamService } from '../../team/team.service';
import { ScoreService } from '../../score/score.service';
import { GameStatus } from '../enums/game-status.enum';
import { createMockRepository } from '../../../test/utils/test-db';
import {
  createMockGame,
  createMockSession,
  createMockTeam,
  createMockGameLibrary,
  resetTestCounters,
} from '../../../test/utils/test-helpers';
import { Session } from '../../session/session.entity';
import { GameLibrary } from '../../game-library/game-library.entity';

describe('GameStatsService', () => {
  let service: GameStatsService;
  let gameRepo: ReturnType<typeof createMockRepository>;
  let teamService: jest.Mocked<
    Pick<TeamService, 'findByGame' | 'getTeamStats'>
  >;
  let scoreService: jest.Mocked<
    Pick<ScoreService, 'getRankedGameScores' | 'determineWinner'>
  >;

  beforeEach(async () => {
    gameRepo = createMockRepository();

    teamService = {
      findByGame: jest.fn(),
      getTeamStats: jest.fn(),
    };

    scoreService = {
      getRankedGameScores: jest.fn(),
      determineWinner: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameStatsService,
        {
          provide: getRepositoryToken(Game),
          useValue: gameRepo,
        },
        {
          provide: TeamService,
          useValue: teamService,
        },
        {
          provide: ScoreService,
          useValue: scoreService,
        },
      ],
    }).compile();

    service = module.get<GameStatsService>(GameStatsService);
    resetTestCounters();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getGameStats', () => {
    it('should return comprehensive game statistics', async () => {
      const session = createMockSession({ id: 'session-1' });
      const gameLibrary = createMockGameLibrary({
        id: 'lib-1',
        name: 'Test Game',
      });
      const game = createMockGame({
        id: 'game-1',
        name: 'Test Game',
        status: GameStatus.IN_PROGRESS,
        currentRound: 2,
        maxRounds: 3,
        currentTurnTeamId: 'team-1',
        turnStartedAt: new Date(Date.now() - 30000), // 30 seconds ago
        turnTimeLimit: 60,
        session: session as Session,
        gameLibrary: gameLibrary as GameLibrary,
      });

      const teamStats = [
        {
          id: 'team-1',
          name: 'Team Alpha',
          color: '#FF0000',
          playerCount: 3,
          totalScore: 100,
          position: 1,
          players: [],
        },
        {
          id: 'team-2',
          name: 'Team Beta',
          color: '#00FF00',
          playerCount: 2,
          totalScore: 80,
          position: 2,
          players: [],
        },
      ];

      gameRepo.findOne.mockResolvedValue(game);
      teamService.getTeamStats.mockResolvedValue(teamStats);

      const result = await service.getGameStats('game-1');

      expect(result.gameId).toBe('game-1');
      expect(result.gameName).toBe('Test Game');
      expect(result.status).toBe(GameStatus.IN_PROGRESS);
      expect(result.currentRound).toBe(2);
      expect(result.maxRounds).toBe(3);
      expect(result.teamsCount).toBe(2);
      expect(result.totalPlayers).toBe(5);
      expect(result.currentTurn).toBeDefined();
      expect(result.currentTurn?.teamId).toBe('team-1');
      expect(result.currentTurn?.duration).toBeGreaterThanOrEqual(30);
      expect(result.teams).toHaveLength(2);
    });

    it('should return null currentTurn if no team is assigned', async () => {
      const session = createMockSession({ id: 'session-1' });
      const game = createMockGame({
        id: 'game-1',
        status: GameStatus.PENDING,
        currentTurnTeamId: undefined,
        session: session as Session,
      });

      gameRepo.findOne.mockResolvedValue(game);
      teamService.getTeamStats.mockResolvedValue([]);

      const result = await service.getGameStats('game-1');

      expect(result.currentTurn).toBeNull();
    });

    it('should throw error if game not found', async () => {
      gameRepo.findOne.mockResolvedValue(null);

      await expect(service.getGameStats('invalid-id')).rejects.toThrow(
        'Game with ID invalid-id not found',
      );
    });
  });

  describe('getResults', () => {
    it('should return game results with standings', async () => {
      const session = createMockSession({ id: 'session-1' });
      const game = createMockGame({
        id: 'game-1',
        name: 'Test Game',
        status: GameStatus.COMPLETED,
        currentRound: 3,
        winnerId: 'team-1',
        completedAt: new Date(),
        session: session as Session,
      });

      const standings = [
        {
          teamId: 'team-1',
          teamName: 'Team Alpha',
          score: 100,
          rank: 1,
          totalPoints: 100,
          bonusPointsCount: 0,
          roundPoints: [],
        },
        {
          teamId: 'team-2',
          teamName: 'Team Beta',
          score: 80,
          rank: 2,
          totalPoints: 80,
          bonusPointsCount: 0,
          roundPoints: [],
        },
      ];

      const winner = {
        winnerId: 'team-1',
        winnerName: 'Team Alpha',
        score: 100,
      };

      gameRepo.findOne.mockResolvedValue(game);
      scoreService.getRankedGameScores.mockResolvedValue(standings);
      scoreService.determineWinner.mockResolvedValue(winner);

      const result = await service.getResults('game-1');

      expect(result.gameId).toBe('game-1');
      expect(result.gameName).toBe('Test Game');
      expect(result.status).toBe(GameStatus.COMPLETED);
      expect(result.winnerId).toBe('team-1');
      expect(result.winnerName).toBe('Team Alpha');
      expect(result.winningScore).toBe(100);
      expect(result.standings).toHaveLength(2);
      expect(result.roundsCompleted).toBe(3);
      expect(result.isTied).toBe(false);
    });

    it('should detect a tie for first place', async () => {
      const session = createMockSession({ id: 'session-1' });
      const game = createMockGame({
        id: 'game-1',
        status: GameStatus.COMPLETED,
        session: session as Session,
      });

      const standings = [
        {
          teamId: 'team-1',
          teamName: 'Team Alpha',
          score: 100,
          rank: 1,
          totalPoints: 100,
          bonusPointsCount: 0,
          roundPoints: [],
        },
        {
          teamId: 'team-2',
          teamName: 'Team Beta',
          score: 100,
          rank: 1,
          totalPoints: 100,
          bonusPointsCount: 0,
          roundPoints: [],
        },
      ];

      gameRepo.findOne.mockResolvedValue(game);
      scoreService.getRankedGameScores.mockResolvedValue(standings);
      scoreService.determineWinner.mockResolvedValue(null);

      const result = await service.getResults('game-1');

      expect(result.isTied).toBe(true);
    });

    it('should throw error if game not found', async () => {
      gameRepo.findOne.mockResolvedValue(null);

      await expect(service.getResults('invalid-id')).rejects.toThrow(
        'Game with ID invalid-id not found',
      );
    });
  });

  describe('getTimerStatus', () => {
    it('should return timer status with elapsed and remaining time', async () => {
      const session = createMockSession({ id: 'session-1' });
      const turnStartedAt = new Date(Date.now() - 30000); // 30 seconds ago
      const game = createMockGame({
        id: 'game-1',
        currentTurnTeamId: 'team-1',
        turnStartedAt,
        turnTimeLimit: 60,
        session: session as Session,
      });

      const teams = [
        createMockTeam({ id: 'team-1', name: 'Team Alpha' }),
        createMockTeam({ id: 'team-2', name: 'Team Beta' }),
      ];

      gameRepo.findOne.mockResolvedValue(game);
      teamService.findByGame.mockResolvedValue(teams as any);

      const result = await service.getTimerStatus('game-1');

      expect(result.gameId).toBe('game-1');
      expect(result.currentTurnTeamId).toBe('team-1');
      expect(result.currentTurnTeamName).toBe('Team Alpha');
      expect(result.turnTimeLimit).toBe(60);
      expect(result.elapsedSeconds).toBeGreaterThanOrEqual(30);
      expect(result.remainingSeconds).toBeLessThanOrEqual(30);
      expect(result.isExpired).toBe(false);
      expect(result.percentageUsed).toBeGreaterThanOrEqual(50);
    });

    it('should return default values if no turn started', async () => {
      const session = createMockSession({ id: 'session-1' });
      const game = createMockGame({
        id: 'game-1',
        currentTurnTeamId: 'team-1',
        turnStartedAt: undefined,
        turnTimeLimit: 60,
        session: session as Session,
      });

      gameRepo.findOne.mockResolvedValue(game);

      const result = await service.getTimerStatus('game-1');

      expect(result.turnStartedAt).toBeNull();
      expect(result.elapsedSeconds).toBe(0);
      expect(result.remainingSeconds).toBe(60);
      expect(result.isExpired).toBe(false);
      expect(result.percentageUsed).toBeNull();
    });

    it('should detect expired timer', async () => {
      const session = createMockSession({ id: 'session-1' });
      const turnStartedAt = new Date(Date.now() - 120000); // 2 minutes ago
      const game = createMockGame({
        id: 'game-1',
        currentTurnTeamId: 'team-1',
        turnStartedAt,
        turnTimeLimit: 60,
        session: session as Session,
      });

      const teams = [createMockTeam({ id: 'team-1', name: 'Team Alpha' })];

      gameRepo.findOne.mockResolvedValue(game);
      teamService.findByGame.mockResolvedValue(teams as any);

      const result = await service.getTimerStatus('game-1');

      expect(result.remainingSeconds).toBe(0);
      expect(result.isExpired).toBe(true);
      expect(result.percentageUsed).toBe(100);
    });

    it('should throw error if game not found', async () => {
      gameRepo.findOne.mockResolvedValue(null);

      await expect(service.getTimerStatus('invalid-id')).rejects.toThrow(
        'Game with ID invalid-id not found',
      );
    });
  });
});
