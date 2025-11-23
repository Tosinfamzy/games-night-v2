import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GameService } from './game.service';
import { Game } from './game.entity';
import { Session } from '../session/session.entity';
import { Team } from '../team/team.entity';
import { Player } from '../player/player.entity';
import { TeamService } from '../team/team.service';
import { ScoreService } from '../score/score.service';
import { GameGateway } from './game.gateway';
import { GameStatus } from './enums/game-status.enum';
import { createMockRepository } from '../../test/utils/test-db';
import {
  createMockGame,
  createMockSession,
  createMockTeam,
  resetTestCounters,
} from '../../test/utils/test-helpers';

describe('GameService', () => {
  let service: GameService;
  let gameRepo: ReturnType<typeof createMockRepository>;
  let sessionRepo: ReturnType<typeof createMockRepository>;
  let teamRepo: ReturnType<typeof createMockRepository>;
  let playerRepo: ReturnType<typeof createMockRepository>;
  let teamService: any;
  let scoreService: any;
  let gameGateway: any;

  beforeEach(async () => {
    gameRepo = createMockRepository<Game>();
    sessionRepo = createMockRepository<Session>();
    teamRepo = createMockRepository<Team>();
    playerRepo = createMockRepository<Player>();

    teamService = {
      findByGame: jest.fn(),
      createTeamsForGame: jest.fn(),
      getTeamStats: jest.fn(),
    };

    scoreService = {
      getRankedGameScores: jest.fn(),
      determineWinner: jest.fn(),
    };

    gameGateway = {
      broadcastGameCompleted: jest.fn(),
      broadcastGameStarted: jest.fn(),
      broadcastGamePaused: jest.fn(),
      broadcastGameResumed: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        {
          provide: getRepositoryToken(Game),
          useValue: gameRepo,
        },
        {
          provide: getRepositoryToken(Session),
          useValue: sessionRepo,
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
          provide: TeamService,
          useValue: teamService,
        },
        {
          provide: ScoreService,
          useValue: scoreService,
        },
        {
          provide: GameGateway,
          useValue: gameGateway,
        },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
    resetTestCounters();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a game successfully', async () => {
      const session = createMockSession({ id: 'session-1' });
      const mockGame = createMockGame({
        name: 'Test Game',
        session: session as Session,
        status: GameStatus.PENDING,
      });

      sessionRepo.findOne.mockResolvedValue(session);
      gameRepo.create.mockReturnValue(mockGame);
      gameRepo.save.mockResolvedValue(mockGame);

      const result = await service.create({
        sessionId: 'session-1',
        name: 'Test Game',
      });

      expect(result).toEqual(mockGame);
      expect(result.status).toBe(GameStatus.PENDING);
      expect(result.currentRound).toBe(0);
    });

    it('should throw NotFoundException if session not found', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          sessionId: 'invalid-session',
          name: 'Test Game',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('State Transitions', () => {
    describe('startGame', () => {
      it('should start a game with valid teams', async () => {
        const game = createMockGame({ id: 'game-1', status: GameStatus.PENDING });
        const teams = [
          createMockTeam({ id: 'team-1' }),
          createMockTeam({ id: 'team-2' }),
        ];

        gameRepo.findOne.mockResolvedValue(game);
        teamRepo.findOne
          .mockResolvedValueOnce(teams[0])
          .mockResolvedValueOnce(teams[1]);
        gameRepo.save.mockResolvedValue({
          ...game,
          status: GameStatus.IN_PROGRESS,
          currentRound: 1,
        });

        const result = await service.startGame('game-1', {
          teamIds: ['team-1', 'team-2'],
        });

        expect(result.status).toBe(GameStatus.IN_PROGRESS);
        expect(result.currentRound).toBe(1);
      });

      it('should throw BadRequestException if game is not PENDING', async () => {
        const game = createMockGame({ status: GameStatus.IN_PROGRESS });
        gameRepo.findOne.mockResolvedValue(game);

        await expect(
          service.startGame('game-1', { teamIds: ['team-1', 'team-2'] }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException if less than 2 teams', async () => {
        const game = createMockGame({ status: GameStatus.PENDING });
        const team = createMockTeam({ id: 'team-1' });

        gameRepo.findOne.mockResolvedValue(game);
        teamRepo.findOne.mockResolvedValue(team);

        await expect(
          service.startGame('game-1', { teamIds: ['team-1'] }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('pauseGame', () => {
      it('should pause a game in progress', async () => {
        const game = createMockGame({ status: GameStatus.IN_PROGRESS });

        gameRepo.findOne.mockResolvedValue(game);
        gameRepo.save.mockResolvedValue({
          ...game,
          status: GameStatus.PAUSED,
        });

        const result = await service.pauseGame('game-1');

        expect(result.status).toBe(GameStatus.PAUSED);
      });

      it('should pause a game in round progress', async () => {
        const game = createMockGame({ status: GameStatus.ROUND_IN_PROGRESS });

        gameRepo.findOne.mockResolvedValue(game);
        gameRepo.save.mockResolvedValue({
          ...game,
          status: GameStatus.PAUSED,
        });

        const result = await service.pauseGame('game-1');

        expect(result.status).toBe(GameStatus.PAUSED);
      });

      it('should throw BadRequestException if game is not in progress', async () => {
        const game = createMockGame({ status: GameStatus.PENDING });
        gameRepo.findOne.mockResolvedValue(game);

        await expect(service.pauseGame('game-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('resumeGame', () => {
      it('should resume a paused game', async () => {
        const game = createMockGame({
          status: GameStatus.PAUSED,
          currentRound: 2,
        });

        gameRepo.findOne.mockResolvedValue(game);
        gameRepo.save.mockResolvedValue({
          ...game,
          status: GameStatus.IN_PROGRESS,
          turnStartedAt: new Date(),
        });

        const result = await service.resumeGame('game-1');

        expect(result.status).toBe(GameStatus.IN_PROGRESS);
        expect(result.turnStartedAt).toBeDefined();
      });

      it('should throw BadRequestException if game is not paused', async () => {
        const game = createMockGame({ status: GameStatus.IN_PROGRESS });
        gameRepo.findOne.mockResolvedValue(game);

        await expect(service.resumeGame('game-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('cancelGame', () => {
      it('should cancel an in-progress game', async () => {
        const game = createMockGame({ status: GameStatus.IN_PROGRESS });

        gameRepo.findOne.mockResolvedValue(game);
        gameRepo.save.mockResolvedValue({
          ...game,
          status: GameStatus.CANCELLED,
        });

        const result = await service.cancelGame('game-1');

        expect(result.status).toBe(GameStatus.CANCELLED);
      });

      it('should throw BadRequestException if game is completed', async () => {
        const game = createMockGame({ status: GameStatus.COMPLETED });
        gameRepo.findOne.mockResolvedValue(game);

        await expect(service.cancelGame('game-1')).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException if game is already cancelled', async () => {
        const game = createMockGame({ status: GameStatus.CANCELLED });
        gameRepo.findOne.mockResolvedValue(game);

        await expect(service.cancelGame('game-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('completeGame', () => {
      it('should complete a game with winner', async () => {
        const game = createMockGame({
          id: 'game-1',
          status: GameStatus.ROUND_ENDED,
          maxRounds: 3,
        });
        const standings = [
          {
            teamId: 'team-1',
            teamName: 'Team A',
            rank: 1,
            totalPoints: 100,
            bonusPointsCount: 2,
            roundPoints: {},
            isTied: false,
          },
        ];
        const winner = { winnerId: 'team-1', winnerName: 'Team A', score: 100 };

        gameRepo.findOne.mockResolvedValue(game);
        scoreService.getRankedGameScores.mockResolvedValue(standings as any);
        scoreService.determineWinner.mockResolvedValue(winner);
        gameRepo.save.mockResolvedValue({
          ...game,
          status: GameStatus.COMPLETED,
          winnerId: 'team-1',
          completedAt: new Date(),
        });

        const result = await service.completeGame('game-1');

        expect(result.status).toBe(GameStatus.COMPLETED);
        expect(result.winnerId).toBe('team-1');
        expect(result.completedAt).toBeDefined();
        expect(gameGateway.broadcastGameCompleted).toHaveBeenCalledWith(
          'game-1',
          expect.any(Object),
        );
      });

      it('should complete a game without winner (tie)', async () => {
        const game = createMockGame({
          status: GameStatus.ROUND_ENDED,
        });
        const standings = [
          {
            teamId: 'team-1',
            teamName: 'Team A',
            rank: 1,
            totalPoints: 100,
            bonusPointsCount: 2,
            roundPoints: {},
            isTied: true,
          },
          {
            teamId: 'team-2',
            teamName: 'Team B',
            rank: 1,
            totalPoints: 100,
            bonusPointsCount: 1,
            roundPoints: {},
            isTied: true,
          },
        ];

        gameRepo.findOne.mockResolvedValue(game);
        scoreService.getRankedGameScores.mockResolvedValue(standings as any);
        scoreService.determineWinner.mockResolvedValue(null);
        gameRepo.save.mockResolvedValue({
          ...game,
          status: GameStatus.COMPLETED,
          completedAt: new Date(),
        });

        const result = await service.completeGame('game-1');

        expect(result.status).toBe(GameStatus.COMPLETED);
        expect(result.winnerId).toBeUndefined();
      });

      it('should throw BadRequestException if game is already completed', async () => {
        const game = createMockGame({ status: GameStatus.COMPLETED });
        gameRepo.findOne.mockResolvedValue(game);

        await expect(service.completeGame('game-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });

  describe('Round Management', () => {
    describe('startFirstRound', () => {
      it('should start the first round', async () => {
        const game = createMockGame({
          status: GameStatus.IN_PROGRESS,
          currentRound: 1,
        });

        gameRepo.findOne.mockResolvedValue(game);
        gameRepo.save.mockResolvedValue({
          ...game,
          status: GameStatus.ROUND_IN_PROGRESS,
        });

        const result = await service.startFirstRound('game-1');

        expect(result.status).toBe(GameStatus.ROUND_IN_PROGRESS);
      });

      it('should throw BadRequestException if game is not IN_PROGRESS', async () => {
        const game = createMockGame({ status: GameStatus.PENDING });
        gameRepo.findOne.mockResolvedValue(game);

        await expect(service.startFirstRound('game-1')).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException if currentRound is not 1', async () => {
        const game = createMockGame({
          status: GameStatus.IN_PROGRESS,
          currentRound: 2,
        });
        gameRepo.findOne.mockResolvedValue(game);

        await expect(service.startFirstRound('game-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('startNextRound', () => {
      it('should start the next round', async () => {
        const game = createMockGame({
          status: GameStatus.ROUND_ENDED,
          currentRound: 2,
          maxRounds: 5,
        });

        gameRepo.findOne.mockResolvedValue(game);
        gameRepo.save.mockResolvedValue({
          ...game,
          currentRound: 3,
          status: GameStatus.ROUND_IN_PROGRESS,
        });

        const result = await service.startNextRound('game-1');

        expect(result.currentRound).toBe(3);
        expect(result.status).toBe(GameStatus.ROUND_IN_PROGRESS);
      });

      it('should throw BadRequestException if current round not ended', async () => {
        const game = createMockGame({ status: GameStatus.ROUND_IN_PROGRESS });
        gameRepo.findOne.mockResolvedValue(game);

        await expect(service.startNextRound('game-1')).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException if max rounds reached', async () => {
        const game = createMockGame({
          status: GameStatus.ROUND_ENDED,
          currentRound: 5,
          maxRounds: 5,
        });
        gameRepo.findOne.mockResolvedValue(game);

        await expect(service.startNextRound('game-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('endCurrentRound', () => {
      it('should end current round when not at max rounds', async () => {
        const game = createMockGame({
          status: GameStatus.ROUND_IN_PROGRESS,
          currentRound: 2,
          maxRounds: 5,
        });

        gameRepo.findOne.mockResolvedValue(game);
        gameRepo.save.mockResolvedValue({
          ...game,
          status: GameStatus.ROUND_ENDED,
        });

        const result = await service.endCurrentRound('game-1');

        expect(result.status).toBe(GameStatus.ROUND_ENDED);
      });

      it('should complete game when ending final round', async () => {
        const game = createMockGame({
          status: GameStatus.ROUND_IN_PROGRESS,
          currentRound: 3,
          maxRounds: 3,
        });

        gameRepo.findOne.mockResolvedValue(game);
        gameRepo.save.mockResolvedValue({
          ...game,
          status: GameStatus.COMPLETED,
        });

        const result = await service.endCurrentRound('game-1');

        expect(result.status).toBe(GameStatus.COMPLETED);
      });

      it('should throw BadRequestException if no round in progress', async () => {
        const game = createMockGame({ status: GameStatus.IN_PROGRESS });
        gameRepo.findOne.mockResolvedValue(game);

        await expect(service.endCurrentRound('game-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });

  describe('Turn Rotation', () => {
    describe('nextTurn', () => {
      it('should rotate to next team automatically', async () => {
        const teams = [
          createMockTeam({ id: 'team-1' }),
          createMockTeam({ id: 'team-2' }),
          createMockTeam({ id: 'team-3' }),
        ];
        const game = createMockGame({
          status: GameStatus.IN_PROGRESS,
          currentTurnTeamId: 'team-1',
        });

        gameRepo.findOne.mockResolvedValue(game);
        teamService.findByGame.mockResolvedValue(teams as any);
        gameRepo.save.mockResolvedValue({
          ...game,
          currentTurnTeamId: 'team-2',
          turnStartedAt: new Date(),
        });

        const result = await service.nextTurn('game-1');

        expect(result.currentTurnTeamId).toBe('team-2');
        expect(result.turnStartedAt).toBeDefined();
      });

      it('should wrap around to first team after last team', async () => {
        const teams = [
          createMockTeam({ id: 'team-1' }),
          createMockTeam({ id: 'team-2' }),
          createMockTeam({ id: 'team-3' }),
        ];
        const game = createMockGame({
          status: GameStatus.IN_PROGRESS,
          currentTurnTeamId: 'team-3',
        });

        gameRepo.findOne.mockResolvedValue(game);
        teamService.findByGame.mockResolvedValue(teams as any);
        gameRepo.save.mockResolvedValue({
          ...game,
          currentTurnTeamId: 'team-1',
        });

        const result = await service.nextTurn('game-1');

        expect(result.currentTurnTeamId).toBe('team-1');
      });

      it('should allow manual team selection', async () => {
        const teams = [
          createMockTeam({ id: 'team-1' }),
          createMockTeam({ id: 'team-2' }),
          createMockTeam({ id: 'team-3' }),
        ];
        const game = createMockGame({
          status: GameStatus.IN_PROGRESS,
          currentTurnTeamId: 'team-1',
        });

        gameRepo.findOne.mockResolvedValue(game);
        teamService.findByGame.mockResolvedValue(teams as any);
        gameRepo.save.mockResolvedValue({
          ...game,
          currentTurnTeamId: 'team-3',
        });

        const result = await service.nextTurn('game-1', { nextTeamId: 'team-3' });

        expect(result.currentTurnTeamId).toBe('team-3');
      });

      it('should throw NotFoundException if manual team selection invalid', async () => {
        const teams = [
          createMockTeam({ id: 'team-1' }),
          createMockTeam({ id: 'team-2' }),
        ];
        const game = createMockGame({ status: GameStatus.IN_PROGRESS });

        gameRepo.findOne.mockResolvedValue(game);
        teamService.findByGame.mockResolvedValue(teams as any);

        await expect(
          service.nextTurn('game-1', { nextTeamId: 'invalid-team' }),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException if game not in progress', async () => {
        const game = createMockGame({ status: GameStatus.PENDING });
        gameRepo.findOne.mockResolvedValue(game);

        await expect(service.nextTurn('game-1')).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException if less than 2 teams', async () => {
        const teams = [createMockTeam({ id: 'team-1' })];
        const game = createMockGame({ status: GameStatus.IN_PROGRESS });

        gameRepo.findOne.mockResolvedValue(game);
        teamService.findByGame.mockResolvedValue(teams as any);

        await expect(service.nextTurn('game-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });

  describe('checkGameReadiness', () => {
    it('should return ready when game has 2+ teams with players', async () => {
      const teams = [
        createMockTeam({ id: 'team-1', players: [{} as any] }),
        createMockTeam({ id: 'team-2', players: [{} as any] }),
      ];
      const game = createMockGame({ status: GameStatus.PENDING });

      gameRepo.findOne.mockResolvedValue(game);
      teamService.findByGame.mockResolvedValue(teams as any);

      const result = await service.checkGameReadiness('game-1');

      expect(result.ready).toBe(true);
      expect(result.teamsCount).toBe(2);
    });

    it('should return not ready if game already started', async () => {
      const game = createMockGame({ status: GameStatus.IN_PROGRESS });

      gameRepo.findOne.mockResolvedValue(game);

      const result = await service.checkGameReadiness('game-1');

      expect(result.ready).toBe(false);
      expect(result.reason).toContain('already');
    });

    it('should return not ready if less than 2 teams', async () => {
      const teams = [createMockTeam({ id: 'team-1', players: [{} as any] })];
      const game = createMockGame({ status: GameStatus.PENDING });

      gameRepo.findOne.mockResolvedValue(game);
      teamService.findByGame.mockResolvedValue(teams as any);

      const result = await service.checkGameReadiness('game-1');

      expect(result.ready).toBe(false);
      expect(result.reason).toContain('At least 2 teams');
    });

    it('should return not ready if teams have no players', async () => {
      const teams = [
        createMockTeam({ id: 'team-1', players: [] }),
        createMockTeam({ id: 'team-2', players: [] }),
      ];
      const game = createMockGame({ status: GameStatus.PENDING });

      gameRepo.findOne.mockResolvedValue(game);
      teamService.findByGame.mockResolvedValue(teams as any);

      const result = await service.checkGameReadiness('game-1');

      expect(result.ready).toBe(false);
      expect(result.reason).toContain('no players');
    });
  });

  describe('updateGameStatus', () => {
    it('should update game status', async () => {
      const game = createMockGame({ status: GameStatus.PENDING });

      gameRepo.findOne.mockResolvedValue(game);
      gameRepo.save.mockResolvedValue({
        ...game,
        status: GameStatus.IN_PROGRESS,
      });

      const result = await service.updateGameStatus(
        'game-1',
        GameStatus.IN_PROGRESS,
      );

      expect(result.status).toBe(GameStatus.IN_PROGRESS);
    });

    it('should throw BadRequestException if changing completed game status', async () => {
      const game = createMockGame({ status: GameStatus.COMPLETED });
      gameRepo.findOne.mockResolvedValue(game);

      await expect(
        service.updateGameStatus('game-1', GameStatus.IN_PROGRESS),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if changing cancelled game status', async () => {
      const game = createMockGame({ status: GameStatus.CANCELLED });
      gameRepo.findOne.mockResolvedValue(game);

      await expect(
        service.updateGameStatus('game-1', GameStatus.IN_PROGRESS),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should delete a game', async () => {
      const game = createMockGame({ id: 'game-1' });

      gameRepo.findOne.mockResolvedValue(game);
      gameRepo.remove.mockResolvedValue(game);

      await service.delete('game-1');

      expect(gameRepo.remove).toHaveBeenCalledWith(game);
    });
  });

  describe('findOne', () => {
    it('should find a game by id', async () => {
      const game = createMockGame({ id: 'game-1' });

      gameRepo.findOne.mockResolvedValue(game);

      const result = await service.findOne('game-1');

      expect(result).toEqual(game);
    });

    it('should throw NotFoundException if game not found', async () => {
      gameRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
