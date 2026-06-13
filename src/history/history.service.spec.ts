import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { HistoryService } from './history.service';
import { GameResult, FinalScore } from './game-result.entity';
import { Game } from '../game/game.entity';
import { Session } from '../session/session.entity';
import { Team } from '../team/team.entity';
import { Player } from '../player/player.entity';
import { Score } from '../score/score.entity';
import { createMockRepository } from '../../test/utils/test-db';

type MockRepo = ReturnType<typeof createMockRepository>;

// Minimal GameResult factory — only the fields buildPlayerStats reads.
const makeResult = (
  gameName: string,
  finalScores: FinalScore[],
  winningTeamId: string | null,
  completedAt: Date,
): GameResult =>
  ({
    gameName,
    finalScores,
    winningTeam: winningTeamId ? ({ id: winningTeamId } as Team) : null,
    completedAt,
  }) as GameResult;

const player = (id: string, name: string, teamIds: string[]): Player =>
  ({ id, name, teams: teamIds.map((t) => ({ id: t }) as Team) }) as Player;

describe('HistoryService', () => {
  let service: HistoryService;
  let gameResultRepo: MockRepo;
  let playerRepo: MockRepo;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        {
          provide: getRepositoryToken(GameResult),
          useValue: createMockRepository(),
        },
        { provide: getRepositoryToken(Game), useValue: createMockRepository() },
        {
          provide: getRepositoryToken(Session),
          useValue: createMockRepository(),
        },
        { provide: getRepositoryToken(Team), useValue: createMockRepository() },
        {
          provide: getRepositoryToken(Player),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Score),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<HistoryService>(HistoryService);
    gameResultRepo = module.get(getRepositoryToken(GameResult));
    playerRepo = module.get(getRepositoryToken(Player));
  });

  describe('getPlayerStats', () => {
    it('matches the player via their team ids and aggregates correctly', async () => {
      // Player is on team-1 (game A) and team-2 (game B).
      playerRepo.findOne.mockResolvedValue(
        player('p1', 'Alice', ['team-1', 'team-2']),
      );
      gameResultRepo.find.mockResolvedValue([
        makeResult(
          'Trivia',
          [
            { teamId: 'team-1', teamName: 'Reds', score: 100, rank: 1 },
            { teamId: 'team-9', teamName: 'Blues', score: 80, rank: 2 },
          ],
          'team-1', // player's team won
          new Date('2026-02-02T00:00:00Z'),
        ),
        makeResult(
          'Charades',
          [
            { teamId: 'team-8', teamName: 'Greens', score: 70, rank: 1 },
            { teamId: 'team-2', teamName: 'Reds', score: 50, rank: 2 },
          ],
          'team-8', // player's team lost
          new Date('2026-01-01T00:00:00Z'),
        ),
        makeResult(
          'Pictionary',
          [{ teamId: 'team-7', teamName: 'Yellows', score: 10, rank: 1 }],
          'team-7', // player not involved
          new Date('2026-03-03T00:00:00Z'),
        ),
      ]);

      const stats = await service.getPlayerStats('p1');

      expect(stats.gamesPlayed).toBe(2); // Trivia + Charades, not Pictionary
      expect(stats.gamesWon).toBe(1); // won Trivia only
      expect(stats.totalScore).toBe(150); // 100 + 50
      expect(stats.winRate).toBe(0.5);
      expect(stats.averageScore).toBe(75);
      expect(stats.lastPlayedAt).toBe('2026-02-02T00:00:00.000Z'); // latest match
    });

    it('returns zeroed stats for a player with no matching results', async () => {
      playerRepo.findOne.mockResolvedValue(player('p2', 'Bob', ['team-x']));
      gameResultRepo.find.mockResolvedValue([
        makeResult(
          'Trivia',
          [{ teamId: 'team-1', teamName: 'Reds', score: 100, rank: 1 }],
          'team-1',
          new Date('2026-02-02T00:00:00Z'),
        ),
      ]);

      const stats = await service.getPlayerStats('p2');

      expect(stats.gamesPlayed).toBe(0);
      expect(stats.gamesWon).toBe(0);
      expect(stats.winRate).toBe(0);
      expect(stats.lastPlayedAt).toBeUndefined();
    });

    it('throws NotFoundException when the player does not exist', async () => {
      playerRepo.findOne.mockResolvedValue(null);
      await expect(service.getPlayerStats('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getLeaderboard', () => {
    it('ranks players by win rate then games won, excluding those with no games', async () => {
      playerRepo.find.mockResolvedValue([
        player('p1', 'Alice', ['team-1']), // 1 game, 1 win -> winRate 1.0
        player('p2', 'Bob', ['team-2']), // 1 game, 0 wins -> winRate 0.0
        player('p3', 'Cara', ['team-3']), // no games -> excluded
      ]);
      gameResultRepo.find.mockResolvedValue([
        makeResult(
          'Trivia',
          [
            { teamId: 'team-1', teamName: 'Reds', score: 100, rank: 1 },
            { teamId: 'team-2', teamName: 'Blues', score: 80, rank: 2 },
          ],
          'team-1',
          new Date('2026-02-02T00:00:00Z'),
        ),
      ]);

      const board = await service.getLeaderboard();

      expect(board.map((s) => s.playerId)).toEqual(['p1', 'p2']);
      expect(board[0].winRate).toBe(1);
      expect(board[1].winRate).toBe(0);
    });
  });
});
