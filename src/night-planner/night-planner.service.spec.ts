import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NightPlannerService } from './night-planner.service';
import { GameFormat } from '../game-library/enums/game-format.enum';
import { GameLibrary } from '../game-library/game-library.entity';
import { Session } from '../session/session.entity';
import { SessionStatus } from '../session/enums/session-status.enum';
import { GameStatus } from '../game/enums/game-status.enum';
import { ScoreMode } from '../game/enums/score-mode.enum';
import { Game } from '../game/game.entity';
import { Team } from '../team/team.entity';

type Repo = { find: jest.Mock; findOne: jest.Mock };

const makeLib = (id: string, over: Partial<GameLibrary> = {}): GameLibrary =>
  ({
    id,
    name: `Game ${id}`,
    format: GameFormat.ALL_TEAMS,
    recommendedRounds: 1,
    playersPerRound: null,
    minTeams: null,
    winnerBonusPoints: null,
    estimatedDuration: 10,
    minPlayers: 2,
    maxPlayers: 30,
    isActive: true,
    ...over,
  }) as GameLibrary;

describe('NightPlannerService', () => {
  let service: NightPlannerService;
  let gameLibraryRepo: Repo;
  let sessionRepo: Repo;
  let sessionService: { findOne: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(() => {
    gameLibraryRepo = { find: jest.fn(), findOne: jest.fn() };
    sessionRepo = { find: jest.fn(), findOne: jest.fn() };
    sessionService = { findOne: jest.fn() };
    dataSource = { transaction: jest.fn() };

    service = new NightPlannerService(
      gameLibraryRepo as never,
      sessionRepo as never,
      sessionService as never,
      dataSource as never,
    );
  });

  describe('suggestPlan', () => {
    it('preserves the requested game order and computes timing + split', async () => {
      gameLibraryRepo.find.mockResolvedValue([
        makeLib('b', { name: 'B', estimatedDuration: 20 }),
        makeLib('a', { name: 'A', estimatedDuration: 10 }),
      ]);

      const result = await service.suggestPlan({
        playerCount: 20,
        gameLibraryIds: ['a', 'b'],
      });

      expect(result.games.map((g) => g.name)).toEqual(['A', 'B']);
      expect(result.teamSuggestion).toEqual({ teamCount: 3, sizes: [7, 7, 6] });
      expect(result.timeline.totalMinutes).toBe(30);
      expect(result.timeline.items[1].startOffsetMinutes).toBe(10);
      expect(result.warnings).toHaveLength(0);
    });

    it('raises the team count to satisfy a game that needs more teams', async () => {
      gameLibraryRepo.find.mockResolvedValue([makeLib('a', { minTeams: 4 })]);

      const result = await service.suggestPlan({
        playerCount: 20,
        gameLibraryIds: ['a'],
      });

      expect(result.teamSuggestion.teamCount).toBe(4);
    });

    it('warns about games that are unavailable/skipped', async () => {
      gameLibraryRepo.find.mockResolvedValue([makeLib('a')]);

      const result = await service.suggestPlan({
        playerCount: 20,
        gameLibraryIds: ['a', 'missing'],
      });

      expect(result.games).toHaveLength(1);
      expect(result.warnings.some((w) => w.includes('unavailable'))).toBe(true);
    });

    it('warns when a game is under-subscribed for the headcount', async () => {
      gameLibraryRepo.find.mockResolvedValue([
        makeLib('a', { name: 'Heavy Drinkers', minPlayers: 6 }),
      ]);

      const result = await service.suggestPlan({
        playerCount: 4,
        gameLibraryIds: ['a'],
      });

      expect(result.warnings.some((w) => w.includes('Heavy Drinkers'))).toBe(
        true,
      );
    });

    it('prompts for a headcount when none is given', async () => {
      gameLibraryRepo.find.mockResolvedValue([makeLib('a')]);

      const result = await service.suggestPlan({
        playerCount: 0,
        gameLibraryIds: ['a'],
      });

      expect(result.warnings.some((w) => w.includes('headcount'))).toBe(true);
    });
  });

  describe('applyPlan', () => {
    const scheduledSession = (): Session =>
      ({
        id: 'sess-1',
        status: SessionStatus.SCHEDULED,
        games: [],
        teams: [],
      }) as unknown as Session;

    const applyDto = {
      games: [
        { gameLibraryId: 'a', maxRounds: 3, orderIndex: 0 },
        {
          gameLibraryId: 'b',
          maxRounds: 5,
          scoreMode: ScoreMode.INDIVIDUAL,
          orderIndex: 1,
        },
      ],
      teams: { count: 3 },
    };

    it('rejects a session that is not scheduled', async () => {
      sessionRepo.findOne.mockResolvedValue({
        ...scheduledSession(),
        status: SessionStatus.IN_PROGRESS,
      });

      await expect(service.applyPlan('sess-1', applyDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when the session does not exist', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.applyPlan('sess-1', applyDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects duplicate games in the plan', async () => {
      sessionRepo.findOne.mockResolvedValue(scheduledSession());

      await expect(
        service.applyPlan('sess-1', {
          games: [
            { gameLibraryId: 'a', maxRounds: 1, orderIndex: 0 },
            { gameLibraryId: 'a', maxRounds: 1, orderIndex: 1 },
          ],
          teams: { count: 3 },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when a selected game is unavailable', async () => {
      sessionRepo.findOne.mockResolvedValue(scheduledSession());
      gameLibraryRepo.find.mockResolvedValue([makeLib('a')]); // 'b' missing

      await expect(service.applyPlan('sess-1', applyDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates ordered games and empty teams in a transaction', async () => {
      sessionRepo.findOne.mockResolvedValue(scheduledSession());
      gameLibraryRepo.find.mockResolvedValue([makeLib('a'), makeLib('b')]);

      const created: { games: unknown[]; teams: unknown[] } = {
        games: [],
        teams: [],
      };
      const manager = {
        findOne: jest.fn().mockResolvedValue(scheduledSession()),
        remove: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockImplementation((entity, data) => {
          if (entity === Game) created.games.push(data);
          if (entity === Team) created.teams.push(data);
          return data;
        }),
        save: jest.fn().mockResolvedValue(undefined),
      };
      dataSource.transaction.mockImplementation(
        (cb: (m: typeof manager) => unknown) => cb(manager),
      );
      sessionService.findOne.mockResolvedValue({ id: 'sess-1' });

      await service.applyPlan('sess-1', applyDto);

      // Games created in order with the tuned rounds + score mode + orderIndex
      expect(created.games).toHaveLength(2);
      expect(created.games[0]).toMatchObject({
        maxRounds: 3,
        orderIndex: 0,
        scoreMode: ScoreMode.TEAM,
        status: GameStatus.PENDING,
      });
      expect(created.games[1]).toMatchObject({
        maxRounds: 5,
        orderIndex: 1,
        scoreMode: ScoreMode.INDIVIDUAL,
      });

      // Three empty, session-scoped teams with positions
      expect(created.teams).toHaveLength(3);
      expect(created.teams[0]).toMatchObject({ position: 1, players: [] });
      expect(
        (created.teams as Array<{ game?: unknown }>).every(
          (t) => t.game === undefined,
        ),
      ).toBe(true);

      expect(sessionService.findOne).toHaveBeenCalledWith(
        'sess-1',
        expect.arrayContaining(['games', 'teams']),
      );
    });

    it('aborts if the session leaves SCHEDULED before the transaction runs', async () => {
      sessionRepo.findOne.mockResolvedValue(scheduledSession());
      gameLibraryRepo.find.mockResolvedValue([makeLib('a'), makeLib('b')]);
      const manager = {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'sess-1', status: SessionStatus.CANCELLED }),
        remove: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      };
      dataSource.transaction.mockImplementation(
        (cb: (m: typeof manager) => unknown) => cb(manager),
      );

      await expect(service.applyPlan('sess-1', applyDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(manager.save).not.toHaveBeenCalled();
    });
  });
});
