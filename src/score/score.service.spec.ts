import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ScoreService } from './score.service';
import { Score } from './score.entity';
import { Game } from '../game/game.entity';
import { Team } from '../team/team.entity';
import { Player } from '../player/player.entity';
import { GameStatus } from '../game/enums/game-status.enum';
import { createMockRepository } from '../../test/utils/test-db';
import {
  createMockScore,
  createMockGame,
  createMockTeam,
  createMockPlayer,
  createMockSession,
} from '../../test/utils/test-helpers';

describe('ScoreService', () => {
  let service: ScoreService;
  let scoreRepo: ReturnType<typeof createMockRepository>;
  let gameRepo: ReturnType<typeof createMockRepository>;
  let teamRepo: ReturnType<typeof createMockRepository>;
  let playerRepo: ReturnType<typeof createMockRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    scoreRepo = createMockRepository();
    gameRepo = createMockRepository();
    teamRepo = createMockRepository();
    playerRepo = createMockRepository();

    eventEmitter = {
      emit: jest.fn(),
      emitAsync: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      listeners: jest.fn(),
      listenerCount: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoreService,
        {
          provide: getRepositoryToken(Score),
          useValue: scoreRepo,
        },
        {
          provide: getRepositoryToken(Game),
          useValue: gameRepo,
        },
        {
          provide: getRepositoryToken(Team),
          useValue: teamRepo,
        },
        {
          provide: getRepositoryToken(Player),
          useValue: playerRepo,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
      ],
    }).compile();

    service = module.get<ScoreService>(ScoreService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a score successfully', async () => {
      const session = createMockSession();
      const game = createMockGame({
        id: 'game-1',
        status: GameStatus.ROUND_IN_PROGRESS,
        currentRound: 2,
        session: session as any,
      });
      const team = createMockTeam({ id: 'team-1' });
      const mockScore = createMockScore({
        points: 10,
        game: game as Game,
        team: team as Team,
        roundNumber: 2,
      });

      gameRepo.findOne.mockResolvedValue(game);
      teamRepo.findOneBy.mockResolvedValue(team);
      scoreRepo.create.mockReturnValue(mockScore);
      scoreRepo.save.mockResolvedValue(mockScore);

      const result = await service.create({
        gameId: 'game-1',
        teamId: 'team-1',
        points: 10,
        isBonus: false,
      });

      expect(gameRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'game-1' },
        relations: ['session'],
      });
      expect(teamRepo.findOneBy).toHaveBeenCalledWith({ id: 'team-1' });
      expect(scoreRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockScore);
    });

    it('should throw NotFoundException if game not found', async () => {
      gameRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          gameId: 'invalid-game',
          teamId: 'team-1',
          points: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if game is not in ROUND_IN_PROGRESS status', async () => {
      const session = createMockSession();
      const game = createMockGame({
        status: GameStatus.COMPLETED,
        session: session as any,
      });

      gameRepo.findOne.mockResolvedValue(game);

      await expect(
        service.create({
          gameId: 'game-1',
          teamId: 'team-1',
          points: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if player not found', async () => {
      const session = createMockSession();
      const game = createMockGame({
        status: GameStatus.ROUND_IN_PROGRESS,
        session: session as any,
      });

      gameRepo.findOne.mockResolvedValue(game);
      playerRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.create({
          gameId: 'game-1',
          playerId: 'invalid-player',
          points: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create score with player when playerId provided', async () => {
      const session = createMockSession();
      const game = createMockGame({
        status: GameStatus.ROUND_IN_PROGRESS,
        currentRound: 1,
        session: session as any,
      });
      const player = createMockPlayer({ id: 'player-1' });
      const mockScore = createMockScore({
        points: 15,
        game: game as Game,
        player: player as Player,
      });

      gameRepo.findOne.mockResolvedValue(game);
      playerRepo.findOneBy.mockResolvedValue(player);
      scoreRepo.create.mockReturnValue(mockScore);
      scoreRepo.save.mockResolvedValue(mockScore);

      const result = await service.create({
        gameId: 'game-1',
        playerId: 'player-1',
        points: 15,
      });

      expect(playerRepo.findOneBy).toHaveBeenCalledWith({ id: 'player-1' });
      expect(result.player).toEqual(player);
    });
  });

  describe('submitGameScore', () => {
    it('should submit game score and emit event', async () => {
      const session = createMockSession();
      const game = createMockGame({
        id: 'game-1',
        status: GameStatus.ROUND_IN_PROGRESS,
        currentRound: 3,
        session: session as any,
      });
      const team = createMockTeam({ id: 'team-1' });
      const mockScore = createMockScore({
        points: 20,
        game: game as Game,
        team: team as Team,
        roundNumber: 3,
      });

      gameRepo.findOne.mockResolvedValue(game);
      teamRepo.findOne.mockResolvedValue(team);
      scoreRepo.create.mockReturnValue(mockScore);
      scoreRepo.save.mockResolvedValue(mockScore);

      const result = await service.submitGameScore('game-1', {
        teamId: 'team-1',
        score: 20,
        roundNumber: 3,
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('score.submitted', {
        gameId: 'game-1',
        teamId: 'team-1',
        points: 20,
        roundNumber: 3,
      });
      expect(result).toEqual(mockScore);
    });

    it('should use game currentRound if roundNumber not provided', async () => {
      const session = createMockSession();
      const game = createMockGame({
        status: GameStatus.ROUND_IN_PROGRESS,
        currentRound: 5,
        session: session as any,
      });
      const team = createMockTeam({ id: 'team-1' });
      const mockScore = createMockScore({
        roundNumber: 5,
        game: game as Game,
        team: team as Team,
      });

      gameRepo.findOne.mockResolvedValue(game);
      teamRepo.findOne.mockResolvedValue(team);
      scoreRepo.create.mockReturnValue(mockScore);
      scoreRepo.save.mockResolvedValue(mockScore);

      await service.submitGameScore('game-1', {
        teamId: 'team-1',
        score: 10,
      });

      expect(mockScore.roundNumber).toBe(5);
    });
  });

  describe('getRankedGameScores', () => {
    it('should rank teams correctly with no ties', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            teamId: 'team-1',
            teamName: 'Team A',
            totalPoints: '100',
            bonusPointsCount: '2',
            roundNumber: 1,
            roundPoints: '100',
          },
          {
            teamId: 'team-2',
            teamName: 'Team B',
            totalPoints: '80',
            bonusPointsCount: '1',
            roundNumber: 1,
            roundPoints: '80',
          },
          {
            teamId: 'team-3',
            teamName: 'Team C',
            totalPoints: '60',
            bonusPointsCount: '0',
            roundNumber: 1,
            roundPoints: '60',
          },
        ]),
      };

      scoreRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getRankedGameScores('game-1');

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        teamId: 'team-1',
        teamName: 'Team A',
        rank: 1,
        totalPoints: 100,
        bonusPointsCount: 2,
        roundPoints: { 1: 100 },
        isTied: false,
      });
      expect(result[1]).toEqual({
        teamId: 'team-2',
        teamName: 'Team B',
        rank: 2,
        totalPoints: 80,
        bonusPointsCount: 1,
        roundPoints: { 1: 80 },
        isTied: false,
      });
      expect(result[2]).toEqual({
        teamId: 'team-3',
        teamName: 'Team C',
        rank: 3,
        totalPoints: 60,
        bonusPointsCount: 0,
        roundPoints: { 1: 60 },
        isTied: false,
      });
    });

    it('should handle ties correctly', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            teamId: 'team-1',
            teamName: 'Team A',
            totalPoints: '100',
            bonusPointsCount: '2',
            roundNumber: 1,
            roundPoints: '100',
          },
          {
            teamId: 'team-2',
            teamName: 'Team B',
            totalPoints: '100',
            bonusPointsCount: '1',
            roundNumber: 1,
            roundPoints: '100',
          },
          {
            teamId: 'team-3',
            teamName: 'Team C',
            totalPoints: '80',
            bonusPointsCount: '0',
            roundNumber: 1,
            roundPoints: '80',
          },
        ]),
      };

      scoreRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getRankedGameScores('game-1');

      expect(result).toHaveLength(3);
      // Both Team A and Team B should have rank 1
      expect(result[0].rank).toBe(1);
      expect(result[0].isTied).toBe(false); // First team is not tied
      expect(result[1].rank).toBe(1);
      expect(result[1].isTied).toBe(true); // Second team is tied
      // Team C should have rank 3 (not 2, because two teams are tied at rank 1)
      expect(result[2].rank).toBe(3);
      expect(result[2].isTied).toBe(false);
    });

    it('should aggregate points across multiple rounds', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            teamId: 'team-1',
            teamName: 'Team A',
            totalPoints: '150',
            bonusPointsCount: '2',
            roundNumber: 1,
            roundPoints: '50',
          },
          {
            teamId: 'team-1',
            teamName: 'Team A',
            totalPoints: '150',
            bonusPointsCount: '2',
            roundNumber: 2,
            roundPoints: '50',
          },
          {
            teamId: 'team-1',
            teamName: 'Team A',
            totalPoints: '150',
            bonusPointsCount: '2',
            roundNumber: 3,
            roundPoints: '50',
          },
        ]),
      };

      scoreRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getRankedGameScores('game-1');

      expect(result).toHaveLength(1);
      expect(result[0].totalPoints).toBe(150);
      expect(result[0].roundPoints).toEqual({
        1: 50,
        2: 50,
        3: 50,
      });
    });
  });

  describe('determineWinner', () => {
    it('should return winner when there is a clear winner', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            teamId: 'team-1',
            teamName: 'Team A',
            totalPoints: '150',
            bonusPointsCount: '3',
            roundNumber: 1,
            roundPoints: '150',
          },
          {
            teamId: 'team-2',
            teamName: 'Team B',
            totalPoints: '120',
            bonusPointsCount: '1',
            roundNumber: 1,
            roundPoints: '120',
          },
        ]),
      };

      scoreRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.determineWinner('game-1');

      expect(result).toEqual({
        winnerId: 'team-1',
        winnerName: 'Team A',
        score: 150,
      });
    });

    it('should return null when there is a tie for first place', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            teamId: 'team-1',
            teamName: 'Team A',
            totalPoints: '150',
            bonusPointsCount: '3',
            roundNumber: 1,
            roundPoints: '150',
          },
          {
            teamId: 'team-2',
            teamName: 'Team B',
            totalPoints: '150',
            bonusPointsCount: '2',
            roundNumber: 1,
            roundPoints: '150',
          },
        ]),
      };

      scoreRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.determineWinner('game-1');

      expect(result).toBeNull();
    });

    it('should return null when there are no teams', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      scoreRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.determineWinner('game-1');

      expect(result).toBeNull();
    });
  });

  describe('getSessionLeaderboard', () => {
    it('should aggregate scores across multiple games', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            teamId: 'team-1',
            teamName: 'Team A',
            gameId: 'game-1',
            gamePoints: '100',
          },
          {
            teamId: 'team-1',
            teamName: 'Team A',
            gameId: 'game-2',
            gamePoints: '120',
          },
          {
            teamId: 'team-2',
            teamName: 'Team B',
            gameId: 'game-1',
            gamePoints: '80',
          },
          {
            teamId: 'team-2',
            teamName: 'Team B',
            gameId: 'game-2',
            gamePoints: '90',
          },
        ]),
      };

      scoreRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getSessionLeaderboard('session-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        teamId: 'team-1',
        teamName: 'Team A',
        totalPoints: 220, // 100 + 120
        gamesPlayed: 2,
        gamePoints: {
          'game-1': 100,
          'game-2': 120,
        },
      });
      expect(result[1]).toMatchObject({
        teamId: 'team-2',
        teamName: 'Team B',
        totalPoints: 170, // 80 + 90
        gamesPlayed: 2,
      });
    });

    it('should count wins correctly', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            teamId: 'team-1',
            teamName: 'Team A',
            gameId: 'game-1',
            gamePoints: '100', // Wins game-1
          },
          {
            teamId: 'team-1',
            teamName: 'Team A',
            gameId: 'game-2',
            gamePoints: '80', // Loses game-2
          },
          {
            teamId: 'team-2',
            teamName: 'Team B',
            gameId: 'game-1',
            gamePoints: '90', // Loses game-1
          },
          {
            teamId: 'team-2',
            teamName: 'Team B',
            gameId: 'game-2',
            gamePoints: '120', // Wins game-2
          },
        ]),
      };

      scoreRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getSessionLeaderboard('session-1');

      expect(result[0].gamesWon).toBe(1); // Team A won game-1
      expect(result[1].gamesWon).toBe(1); // Team B won game-2
    });

    it('should not count wins for tied games', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            teamId: 'team-1',
            teamName: 'Team A',
            gameId: 'game-1',
            gamePoints: '100', // Tied with team-2
          },
          {
            teamId: 'team-2',
            teamName: 'Team B',
            gameId: 'game-1',
            gamePoints: '100', // Tied with team-1
          },
        ]),
      };

      scoreRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getSessionLeaderboard('session-1');

      // Neither team should get a win for a tied game
      expect(result[0].gamesWon).toBe(0);
      expect(result[1].gamesWon).toBe(0);
    });
  });

  describe('update', () => {
    it('should update score points', async () => {
      const mockScore = createMockScore({ id: 'score-1', points: 10 });

      scoreRepo.findOne.mockResolvedValue(mockScore);
      scoreRepo.save.mockResolvedValue({ ...mockScore, points: 20 });

      const result = await service.update('score-1', { points: 20 });

      expect(result.points).toBe(20);
      expect(scoreRepo.save).toHaveBeenCalled();
    });

    it('should update isBonus field', async () => {
      const mockScore = createMockScore({ id: 'score-1', isBonus: false });

      scoreRepo.findOne.mockResolvedValue(mockScore);
      scoreRepo.save.mockResolvedValue({ ...mockScore, isBonus: true });

      const result = await service.update('score-1', { isBonus: true });

      expect(result.isBonus).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete a score', async () => {
      const mockScore = createMockScore({ id: 'score-1' });

      scoreRepo.findOne.mockResolvedValue(mockScore);
      scoreRepo.remove.mockResolvedValue(mockScore);

      await service.delete('score-1');

      expect(scoreRepo.remove).toHaveBeenCalledWith(mockScore);
    });

    it('should throw NotFoundException if score not found', async () => {
      scoreRepo.findOne.mockResolvedValue(null);

      await expect(service.delete('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne', () => {
    it('should find a score by id', async () => {
      const mockScore = createMockScore({ id: 'score-1' });

      scoreRepo.findOne.mockResolvedValue(mockScore);

      const result = await service.findOne('score-1');

      expect(result).toEqual(mockScore);
      expect(scoreRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'score-1' },
        relations: ['game', 'team', 'player'],
      });
    });

    it('should throw NotFoundException if score not found', async () => {
      scoreRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all scores', async () => {
      const mockScores = [
        createMockScore({ id: 'score-1' }),
        createMockScore({ id: 'score-2' }),
      ];

      scoreRepo.find.mockResolvedValue(mockScores);

      const result = await service.findAll();

      expect(result).toEqual(mockScores);
      expect(scoreRepo.find).toHaveBeenCalledWith({
        relations: ['game', 'team', 'player'],
        order: { createdAt: 'DESC' },
      });
    });
  });
});
