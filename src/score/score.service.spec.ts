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
import { ScoreMode } from '../game/enums/score-mode.enum';
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
      const team = createMockTeam({ id: 'team-1' });
      const game = createMockGame({
        id: 'game-1',
        status: GameStatus.ROUND_IN_PROGRESS,
        currentRound: 2,
        session: session as any,
        teams: [team] as any,
      });
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
        relations: ['session', 'teams', 'session.teams'],
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
      const team = createMockTeam({ id: 'team-1', session: session as any });
      const game = createMockGame({
        id: 'game-1',
        status: GameStatus.ROUND_IN_PROGRESS,
        currentRound: 3,
        session: session as any,
        teams: [team] as any,
      });
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
        entrantType: 'team',
        entrantId: 'team-1',
        teamId: 'team-1',
        playerId: undefined,
        points: 20,
        roundNumber: 3,
      });
      expect(result).toEqual(mockScore);
    });

    it('records an individual-mode score against the player', async () => {
      const player = createMockPlayer({ id: 'player-1', name: 'Ada' });
      const session = createMockSession({ players: [player] as any });
      const game = createMockGame({
        id: 'game-1',
        status: GameStatus.ROUND_IN_PROGRESS,
        currentRound: 2,
        scoreMode: ScoreMode.INDIVIDUAL,
        session: session as any,
        teams: [],
      });
      const mockScore = createMockScore({
        points: 15,
        game: game as Game,
        player: player as Player,
        roundNumber: 2,
      });

      gameRepo.findOne.mockResolvedValue(game);
      scoreRepo.create.mockReturnValue(mockScore);
      scoreRepo.save.mockResolvedValue(mockScore);

      const result = await service.submitGameScore('game-1', {
        playerId: 'player-1',
        score: 15,
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('score.submitted', {
        gameId: 'game-1',
        entrantType: 'player',
        entrantId: 'player-1',
        teamId: undefined,
        playerId: 'player-1',
        points: 15,
        roundNumber: 2,
      });
      expect(result).toEqual(mockScore);
    });

    it('rejects an individual-mode score for a player not in the session', async () => {
      const game = createMockGame({
        id: 'game-1',
        status: GameStatus.ROUND_IN_PROGRESS,
        scoreMode: ScoreMode.INDIVIDUAL,
        session: createMockSession({ players: [] }) as any,
        teams: [],
      });
      gameRepo.findOne.mockResolvedValue(game);

      await expect(
        service.submitGameScore('game-1', { playerId: 'stranger', score: 5 }),
      ).rejects.toThrow();
    });

    it('rejects an individual-mode score with no playerId', async () => {
      const game = createMockGame({
        id: 'game-1',
        status: GameStatus.ROUND_IN_PROGRESS,
        scoreMode: ScoreMode.INDIVIDUAL,
        session: createMockSession() as any,
        teams: [],
      });
      gameRepo.findOne.mockResolvedValue(game);

      await expect(
        service.submitGameScore('game-1', { score: 5 }),
      ).rejects.toThrow();
    });

    it('should use game currentRound if roundNumber not provided', async () => {
      const session = createMockSession();
      const team = createMockTeam({ id: 'team-1', session: session as any });
      const game = createMockGame({
        status: GameStatus.ROUND_IN_PROGRESS,
        currentRound: 5,
        session: session as any,
        teams: [team] as any,
      });
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

    it('rejects a team that is not one of this game’s teams', async () => {
      // The game has its own team; the submitted team-x isn't in game.teams.
      const ownTeam = createMockTeam({ id: 'team-own' });
      const game = createMockGame({
        id: 'game-1',
        status: GameStatus.ROUND_IN_PROGRESS,
        currentRound: 1,
        session: createMockSession({ id: 'session-A' }) as any,
        teams: [ownTeam] as any,
      });
      const foreignTeam = createMockTeam({ id: 'team-x' });
      gameRepo.findOne.mockResolvedValue(game);
      teamRepo.findOne.mockResolvedValue(foreignTeam);

      await expect(
        service.submitGameScore('game-1', { teamId: 'team-x', score: 5 }),
      ).rejects.toThrow('Team is not part of this game');
      expect(scoreRepo.save).not.toHaveBeenCalled();
    });

    it('scores a session fixed team even when the game has no teams of its own', async () => {
      // Night Builder model: the game has no game-scoped teams; the session
      // carries the fixed teams (game == null), and they must be scorable.
      const fixedTeam = createMockTeam({ id: 'fixed-1' }); // game undefined
      const session = createMockSession({ teams: [fixedTeam] as any });
      const game = createMockGame({
        id: 'game-1',
        status: GameStatus.ROUND_IN_PROGRESS,
        currentRound: 1,
        session: session as any,
        teams: [], // no game-scoped teams
      });
      const mockScore = createMockScore({ points: 7, game: game as Game });

      gameRepo.findOne.mockResolvedValue(game);
      teamRepo.findOne.mockResolvedValue(fixedTeam);
      scoreRepo.create.mockReturnValue(mockScore);
      scoreRepo.save.mockResolvedValue(mockScore);

      await service.submitGameScore('game-1', { teamId: 'fixed-1', score: 7 });

      expect(scoreRepo.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'score.submitted',
        expect.objectContaining({ teamId: 'fixed-1' }),
      );
    });
  });

  describe('getGameScores includes teams with no scores', () => {
    it('seeds every team in the game at 0 so a scoreless team still ranks', async () => {
      // Two teams in the game; only team-1 has a (negative) score row.
      gameRepo.findOne.mockResolvedValue({
        id: 'game-1',
        teams: [
          { id: 'team-1', name: 'A' },
          { id: 'team-2', name: 'B' },
        ],
      });
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            teamId: 'team-1',
            teamName: 'A',
            bonusPointsCount: '0',
            roundNumber: 1,
            roundPoints: '-5',
          },
        ]),
      };
      scoreRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getGameScores('game-1');

      expect(result).toHaveLength(2);
      const teamB = result.find((t) => t.teamId === 'team-2');
      // The scoreless team is present at 0 and thus outranks team-1 at -5.
      expect(teamB).toBeDefined();
      expect(teamB!.totalPoints).toBe(0);
      expect(result.find((t) => t.teamId === 'team-1')!.totalPoints).toBe(-5);
    });
  });

  describe('getGameScores multi-round totals', () => {
    it('sums totalPoints across every round, not just one', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        // Team A played 3 rounds: 40 + 30 + 30 = 100.
        getRawMany: jest.fn().mockResolvedValue([
          {
            teamId: 'team-1',
            teamName: 'A',
            bonusPointsCount: '1',
            roundNumber: 1,
            roundPoints: '40',
          },
          {
            teamId: 'team-1',
            teamName: 'A',
            bonusPointsCount: '0',
            roundNumber: 2,
            roundPoints: '30',
          },
          {
            teamId: 'team-1',
            teamName: 'A',
            bonusPointsCount: '1',
            roundNumber: 3,
            roundPoints: '30',
          },
        ]),
      };
      scoreRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getGameScores('game-1');

      expect(result).toHaveLength(1);
      expect(result[0].totalPoints).toBe(100);
      expect(result[0].bonusPointsCount).toBe(2);
      expect(result[0].roundPoints).toEqual({ 1: 40, 2: 30, 3: 30 });
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
        entrantType: 'team',
        rank: 1,
        totalPoints: 100,
        bonusPointsCount: 2,
        roundPoints: { 1: 100 },
        isTied: false,
      });
      expect(result[1]).toEqual({
        teamId: 'team-2',
        teamName: 'Team B',
        entrantType: 'team',
        rank: 2,
        totalPoints: 80,
        bonusPointsCount: 1,
        roundPoints: { 1: 80 },
        isTied: false,
      });
      expect(result[2]).toEqual({
        teamId: 'team-3',
        teamName: 'Team C',
        entrantType: 'team',
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
      // Both Team A and Team B share rank 1, so BOTH are tied — including the
      // leading team, which a "tied with previous" check used to miss.
      expect(result[0].rank).toBe(1);
      expect(result[0].isTied).toBe(true);
      expect(result[1].rank).toBe(1);
      expect(result[1].isTied).toBe(true);
      // Team C is alone at rank 3 (not 2, because two teams tie at rank 1).
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
    // Minimal team standing (as getRankedGameScores returns) for a game.
    const standing = (
      teamId: string,
      teamName: string,
      rank: number,
      over: Record<string, unknown> = {},
    ) => ({
      teamId,
      teamName,
      entrantType: 'team' as const,
      rank,
      totalPoints: 0,
      bonusPointsCount: 0,
      roundPoints: {},
      isTied: false,
      ...over,
    });

    it('awards placement points (3/2/1) across completed games', async () => {
      gameRepo.find.mockResolvedValue([
        createMockGame({ id: 'game-1', status: GameStatus.COMPLETED }),
        createMockGame({ id: 'game-2', status: GameStatus.COMPLETED }),
      ]);
      // Two fixed session teams (game undefined → session-scoped).
      teamRepo.find.mockResolvedValue([
        createMockTeam({ id: 'team-A', name: 'A' }),
        createMockTeam({ id: 'team-B', name: 'B' }),
      ]);
      jest
        .spyOn(service, 'getRankedGameScores')
        .mockResolvedValue([
          standing('team-A', 'A', 1),
          standing('team-B', 'B', 2),
        ]);

      const result = await service.getSessionLeaderboard('session-1');
      const a = result.find((r) => r.teamId === 'team-A')!;
      const b = result.find((r) => r.teamId === 'team-B')!;

      expect(a.totalPoints).toBe(6); // 1st + 1st = 3 + 3
      expect(b.totalPoints).toBe(4); // 2nd + 2nd = 2 + 2
      expect(a.gamesWon).toBe(2);
      expect(result[0].teamId).toBe('team-A'); // sorted by placement total
    });

    it('applies a game’s flat winner bonus instead of placement', async () => {
      gameRepo.find.mockResolvedValue([
        createMockGame({
          id: 'game-1',
          status: GameStatus.COMPLETED,
          gameLibrary: { winnerBonusPoints: 5 } as any,
        }),
      ]);
      teamRepo.find.mockResolvedValue([
        createMockTeam({ id: 'team-A', name: 'A' }),
        createMockTeam({ id: 'team-B', name: 'B' }),
      ]);
      jest
        .spyOn(service, 'getRankedGameScores')
        .mockResolvedValue([
          standing('team-A', 'A', 1),
          standing('team-B', 'B', 2),
        ]);

      const result = await service.getSessionLeaderboard('session-1');

      expect(result.find((r) => r.teamId === 'team-A')!.totalPoints).toBe(5);
      expect(result.find((r) => r.teamId === 'team-B')!.totalPoints).toBe(0);
    });

    it('gives tied first-place teams equal points and no win', async () => {
      gameRepo.find.mockResolvedValue([
        createMockGame({ id: 'game-1', status: GameStatus.COMPLETED }),
      ]);
      teamRepo.find.mockResolvedValue([
        createMockTeam({ id: 'team-A', name: 'A' }),
        createMockTeam({ id: 'team-B', name: 'B' }),
      ]);
      jest
        .spyOn(service, 'getRankedGameScores')
        .mockResolvedValue([
          standing('team-A', 'A', 1, { isTied: true }),
          standing('team-B', 'B', 1, { isTied: true }),
        ]);

      const result = await service.getSessionLeaderboard('session-1');

      expect(result.find((r) => r.teamId === 'team-A')!.totalPoints).toBe(3);
      expect(result.find((r) => r.teamId === 'team-B')!.totalPoints).toBe(3);
      expect(result.every((r) => r.gamesWon === 0)).toBe(true);
    });

    it('seeds the session’s fixed teams at 0 and ignores game-scoped teams', async () => {
      gameRepo.find.mockResolvedValue([]); // no completed games yet
      teamRepo.find.mockResolvedValue([
        createMockTeam({ id: 'team-A', name: 'A' }), // fixed (game undefined)
        createMockTeam({
          id: 'team-legacy',
          name: 'Legacy',
          game: { id: 'g' } as any, // game-scoped → not a fixed team
        }),
      ]);

      const result = await service.getSessionLeaderboard('session-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        teamId: 'team-A',
        totalPoints: 0,
        gamesPlayed: 0,
      });
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

    it('emits score.updated so live leaderboards refresh on an edit', async () => {
      const mockScore = createMockScore({
        id: 'score-1',
        points: 10,
        roundNumber: 2,
        game: { id: 'game-1' } as Game,
        team: { id: 'team-1' } as Team,
      });

      scoreRepo.findOne.mockResolvedValue(mockScore);
      scoreRepo.save.mockResolvedValue({ ...mockScore, points: 20 });

      await service.update('score-1', { points: 20 });

      expect(eventEmitter.emit).toHaveBeenCalledWith('score.updated', {
        gameId: 'game-1',
        entrantType: 'team',
        entrantId: 'team-1',
        teamId: 'team-1',
        playerId: undefined,
        points: 20,
        roundNumber: 2,
      });
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

    it('emits score.updated so live leaderboards refresh on a delete', async () => {
      const mockScore = createMockScore({
        id: 'score-1',
        points: 7,
        roundNumber: 1,
        game: { id: 'game-1' } as Game,
        player: { id: 'player-1' } as Player,
      });

      scoreRepo.findOne.mockResolvedValue(mockScore);
      scoreRepo.remove.mockResolvedValue(mockScore);

      await service.delete('score-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith('score.updated', {
        gameId: 'game-1',
        entrantType: 'player',
        entrantId: 'player-1',
        teamId: undefined,
        playerId: 'player-1',
        points: 7,
        roundNumber: 1,
      });
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
