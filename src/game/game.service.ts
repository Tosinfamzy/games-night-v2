import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './game.entity';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { StartGameDto } from './dto/start-game.dto';
import { StartGameWithTeamsDto } from './dto/start-game-with-teams.dto';
import { NextTurnDto } from './dto/next-turn.dto';
import { Session } from '../session/session.entity';
import { Team } from '../team/team.entity';
import { Player } from '../player/player.entity';
import { TeamService } from '../team/team.service';
import { ScoreService } from '../score/score.service';
import { GameStatus } from './enums/game-status.enum';
import { CreateTeamsDto } from '../team/dto/team-formation.dto';
import { GameResultsDto } from '../common/dto/game-results.dto';
import { GameGateway } from './game.gateway';
import { GameTimerService } from './game-timer.service';
import { HistoryService } from '../history/history.service';
import { GameStatsService } from './services/game-stats.service';
import { GameStats } from './interfaces/game.interface';

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(Game)
    private readonly repo: Repository<Game>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    private readonly teamService: TeamService,
    private readonly scoreService: ScoreService,
    @Inject(forwardRef(() => GameGateway))
    private readonly gameGateway: GameGateway,
    @Inject(forwardRef(() => GameTimerService))
    private readonly gameTimerService: GameTimerService,
    @Inject(forwardRef(() => HistoryService))
    private readonly historyService: HistoryService,
    @Inject(forwardRef(() => GameStatsService))
    private readonly statsService: GameStatsService,
  ) {}

  async create(dto: CreateGameDto): Promise<Game> {
    const session = await this.sessionRepo.findOne({
      where: { id: dto.sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${dto.sessionId} not found`);
    }

    const game = this.repo.create({
      name: dto.name,
      session,
      maxRounds: dto.maxRounds || 1,
      currentRound: 0,
      status: GameStatus.PENDING,
    });
    return await this.repo.save(game);
  }

  async findAll(): Promise<Game[]> {
    return this.repo.find({
      relations: ['session', 'teams', 'scores', 'gameLibrary'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Game> {
    const game = await this.repo.findOne({
      where: { id },
      relations: ['session', 'teams', 'scores', 'gameLibrary'],
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${id} not found`);
    }
    return game;
  }

  async startGame(id: string, dto: StartGameDto): Promise<Game> {
    const game = await this.findOne(id);

    if (game.status !== GameStatus.PENDING) {
      throw new BadRequestException(`Game is already ${game.status}`);
    }

    // Validate and fetch teams
    const teams = await Promise.all(
      dto.teamIds.map(async (teamId) => {
        const team = await this.teamRepo.findOne({ where: { id: teamId } });
        if (!team) {
          throw new NotFoundException(`Team with ID ${teamId} not found`);
        }
        return team;
      }),
    );

    if (teams.length < 2) {
      throw new BadRequestException(
        'At least two teams are required to start a game',
      );
    }

    // Set teams and update game status
    game.teams = teams;
    game.status = GameStatus.IN_PROGRESS;
    game.currentRound = 1;

    const savedGame = await this.repo.save(game);

    // Broadcast game started event
    this.gameGateway.broadcastGameStarted(savedGame.id, savedGame);

    return savedGame;
  }

  async startFirstRound(id: string): Promise<Game> {
    const game = await this.findOne(id);

    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Cannot start first round. Game must be in progress but no round started yet.',
      );
    }

    if (game.currentRound !== 1) {
      throw new BadRequestException(
        'Cannot start first round. Current round should be 1.',
      );
    }

    game.status = GameStatus.ROUND_IN_PROGRESS;
    const savedGame = await this.repo.save(game);

    // Broadcast round started event
    this.gameGateway.broadcastRoundStarted(savedGame.id, 1);

    return savedGame;
  }

  async startNextRound(id: string): Promise<Game> {
    const game = await this.findOne(id);

    if (game.status !== GameStatus.ROUND_ENDED) {
      throw new BadRequestException(
        'Cannot start next round. Current round must be ended first.',
      );
    }

    if (game.currentRound >= game.maxRounds) {
      throw new BadRequestException('Maximum number of rounds reached');
    }

    game.currentRound += 1;
    game.status = GameStatus.ROUND_IN_PROGRESS;

    const savedGame = await this.repo.save(game);

    // Broadcast round started event
    this.gameGateway.broadcastRoundStarted(
      savedGame.id,
      savedGame.currentRound,
    );

    return savedGame;
  }

  async endCurrentRound(id: string): Promise<Game> {
    const game = await this.findOne(id);

    if (game.status !== GameStatus.ROUND_IN_PROGRESS) {
      throw new BadRequestException('No round is currently in progress');
    }

    game.status = GameStatus.ROUND_ENDED;

    if (game.currentRound === game.maxRounds) {
      game.status = GameStatus.COMPLETED;
    }

    const savedGame = await this.repo.save(game);

    // Broadcast round ended event
    this.gameGateway.broadcastRoundEnded(savedGame.id, savedGame.currentRound);

    return savedGame;
  }

  async cancelGame(id: string): Promise<Game> {
    const game = await this.findOne(id);

    if (
      game.status === GameStatus.COMPLETED ||
      game.status === GameStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel a ${game.status.toLowerCase()} game`,
      );
    }

    game.status = GameStatus.CANCELLED;
    return await this.repo.save(game);
  }

  async update(id: string, dto: UpdateGameDto): Promise<Game> {
    const game = await this.findOne(id);

    if (dto.sessionId) {
      const session = await this.sessionRepo.findOne({
        where: { id: dto.sessionId },
      });

      if (!session) {
        throw new NotFoundException(
          `Session with ID ${dto.sessionId} not found`,
        );
      }

      game.session = session;
    }

    if (dto.name) {
      game.name = dto.name;
    }

    return this.repo.save(game);
  }

  async delete(id: string): Promise<void> {
    const game = await this.findOne(id);
    await this.repo.remove(game);
  }

  // ============ ENHANCED GAME FLOW METHODS ============

  /**
   * Start a game with automatic team formation
   */
  async startGameWithTeams(
    id: string,
    dto: StartGameWithTeamsDto,
  ): Promise<Game> {
    const game = await this.findOne(id);

    if (game.status !== GameStatus.PENDING) {
      throw new BadRequestException(`Game is already ${game.status}`);
    }

    // Create teams using the team service
    const createTeamsDto: CreateTeamsDto = {
      teamCount: dto.teamCount,
      strategy: dto.strategy,
    };

    const teams = await this.teamService.createTeamsForGame(
      game.id,
      createTeamsDto,
    );

    if (teams.length < 2) {
      throw new BadRequestException(
        'At least two teams are required to start a game',
      );
    }

    // Update game with teams and start
    game.status = GameStatus.IN_PROGRESS;
    game.currentRound = 1;
    game.turnTimeLimit = dto.turnTimeLimit;

    // Set the first team's turn
    if (teams.length > 0) {
      game.currentTurnTeamId = teams[0].id;
      game.turnStartedAt = new Date();
    }

    return await this.repo.save(game);
  }

  /**
   * Check if a game is ready to start (has teams formed)
   */
  async checkGameReadiness(
    id: string,
  ): Promise<{ ready: boolean; reason?: string; teamsCount: number }> {
    const game = await this.findOne(id);

    if (game.status !== GameStatus.PENDING) {
      return {
        ready: false,
        reason: `Game is already ${game.status}`,
        teamsCount: game.teams?.length || 0,
      };
    }

    const teams = await this.teamService.findByGame(id);

    if (teams.length < 2) {
      return {
        ready: false,
        reason: 'At least 2 teams are required to start the game',
        teamsCount: teams.length,
      };
    }

    // Check if all teams have players
    const emptyTeams = teams.filter(
      (team) => !team.players || team.players.length === 0,
    );
    if (emptyTeams.length > 0) {
      return {
        ready: false,
        reason: `${emptyTeams.length} team(s) have no players assigned`,
        teamsCount: teams.length,
      };
    }

    return { ready: true, teamsCount: teams.length };
  }

  /**
   * Move to the next team's turn
   */
  async nextTurn(id: string, dto?: NextTurnDto): Promise<Game> {
    const game = await this.findOne(id);

    if (
      game.status !== GameStatus.IN_PROGRESS &&
      game.status !== GameStatus.ROUND_IN_PROGRESS
    ) {
      throw new BadRequestException('Game must be in progress to change turns');
    }

    const teams = await this.teamService.findByGame(id);

    if (teams.length < 2) {
      throw new BadRequestException(
        'Game needs at least 2 teams for turn management',
      );
    }

    let nextTeamId: string;

    if (dto?.nextTeamId) {
      // Manual team selection
      const selectedTeam = teams.find((team) => team.id === dto.nextTeamId);
      if (!selectedTeam) {
        throw new NotFoundException(
          `Team with ID ${dto.nextTeamId} not found in this game`,
        );
      }
      nextTeamId = dto.nextTeamId;
    } else {
      // Automatic rotation
      const currentIndex = teams.findIndex(
        (team) => team.id === game.currentTurnTeamId,
      );
      const nextIndex = (currentIndex + 1) % teams.length;
      nextTeamId = teams[nextIndex].id;
    }

    const previousTeamId = game.currentTurnTeamId;
    game.currentTurnTeamId = nextTeamId;
    game.turnStartedAt = new Date();

    const savedGame = await this.repo.save(game);

    // Broadcast turn started with timer info and start timer if needed
    const nextTeam = teams.find((team) => team.id === nextTeamId);
    if (nextTeam) {
      this.gameGateway.broadcastTurnStarted(
        game.id,
        nextTeam.id,
        nextTeam.name,
        game.turnTimeLimit,
      );

      // Start timer if game has time limit
      if (game.turnTimeLimit && this.gameTimerService) {
        this.gameTimerService.startTimer(
          game.id,
          nextTeam.id,
          nextTeam.name,
          game.turnTimeLimit,
          game.turnStartedAt,
        );
      }

      // Also broadcast turn advanced (only if not called from auto-advance)
      // Auto-advance is handled by timer service
      if (!dto?.['_auto']) {
        this.gameGateway.broadcastTurnAdvanced(
          game.id,
          previousTeamId || '',
          nextTeam.id,
          nextTeam.name,
          false, // Manual advance (not automatic)
        );
      }
    }

    return savedGame;
  }

  /**
   * Pause the game
   */
  async pauseGame(id: string): Promise<Game> {
    const game = await this.findOne(id);

    if (
      game.status !== GameStatus.IN_PROGRESS &&
      game.status !== GameStatus.ROUND_IN_PROGRESS
    ) {
      throw new BadRequestException(
        'Can only pause games that are in progress',
      );
    }

    game.status = GameStatus.PAUSED;
    const savedGame = await this.repo.save(game);

    // Broadcast game paused event
    this.gameGateway.broadcastGamePaused(savedGame.id);

    return savedGame;
  }

  /**
   * Resume a paused game
   */
  async resumeGame(id: string): Promise<Game> {
    const game = await this.findOne(id);

    if (game.status !== GameStatus.PAUSED) {
      throw new BadRequestException('Game is not paused');
    }

    game.status =
      game.currentRound > 0
        ? GameStatus.IN_PROGRESS
        : GameStatus.ROUND_IN_PROGRESS;
    game.turnStartedAt = new Date(); // Reset turn timer
    const savedGame = await this.repo.save(game);

    // Broadcast game resumed event
    this.gameGateway.broadcastGameResumed(savedGame.id);

    return savedGame;
  }

  /**
   * Get comprehensive game statistics (delegated to GameStatsService)
   */
  async getGameStats(id: string): Promise<GameStats> {
    return this.statsService.getGameStats(id);
  }

  /**
   * Force start a game (bypass team requirements for testing)
   */
  async forceStartGame(id: string): Promise<Game> {
    const game = await this.findOne(id);

    if (game.status !== GameStatus.PENDING) {
      throw new BadRequestException(`Game is already ${game.status}`);
    }

    game.status = GameStatus.IN_PROGRESS;
    game.currentRound = 1;
    game.turnStartedAt = new Date();

    return await this.repo.save(game);
  }

  // Additional game lifecycle methods
  async completeGame(id: string): Promise<Game> {
    const game = await this.findOne(id);

    if (game.status === GameStatus.COMPLETED) {
      throw new BadRequestException('Game is already completed');
    }

    if (game.status === GameStatus.CANCELLED) {
      throw new BadRequestException('Cannot complete a cancelled game');
    }

    // Calculate final standings and determine winner
    const standings = await this.scoreService.getRankedGameScores(id);
    const winner = await this.scoreService.determineWinner(id);

    // Update game with completion data
    game.status = GameStatus.COMPLETED;
    game.currentRound = game.maxRounds;
    game.completedAt = new Date();

    // Store winner if there is one (not a tie)
    if (winner) {
      game.winnerId = winner.winnerId;
    }

    // Store complete results as JSON
    game.results = {
      standings,
      winningScore: winner?.score || null,
      isTied: standings.length > 0 && standings[0].isTied === true,
      completedAt: new Date().toISOString(),
    };

    const savedGame = await this.repo.save(game);

    // Broadcast game completion via WebSocket
    this.gameGateway.broadcastGameCompleted(id, savedGame);

    // Create game result record for history
    try {
      await this.historyService.createGameResult(id);
    } catch (error) {
      console.error('Failed to create game result:', error);
      // Don't fail the entire game completion if history creation fails
    }

    return savedGame;
  }

  /**
   * Get game results with standings (delegated to GameStatsService)
   */
  async getResults(id: string): Promise<GameResultsDto> {
    return this.statsService.getResults(id);
  }

  async updateGameStatus(id: string, status: GameStatus): Promise<Game> {
    const game = await this.findOne(id);

    // Validate status transition
    if (
      game.status === GameStatus.COMPLETED &&
      status !== GameStatus.COMPLETED
    ) {
      throw new BadRequestException('Cannot change status of a completed game');
    }

    if (
      game.status === GameStatus.CANCELLED &&
      status !== GameStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot change status of a cancelled game');
    }

    game.status = status;

    return await this.repo.save(game);
  }

  async getGamesBySession(sessionId: string): Promise<Game[]> {
    return this.repo.find({
      where: { session: { id: sessionId } },
      relations: ['session', 'teams', 'teams.players', 'scores'],
      order: { createdAt: 'ASC' },
    });
  }

  async resetGame(id: string): Promise<Game> {
    const game = await this.findOne(id);

    if (game.status === GameStatus.COMPLETED) {
      throw new BadRequestException('Cannot reset a completed game');
    }

    // Reset game state
    game.status = GameStatus.PENDING;
    game.currentRound = 0;
    game.currentTurnTeamId = undefined;
    game.turnStartedAt = undefined;
    game.winnerId = undefined;
    game.results = undefined;
    game.completedAt = undefined;

    return await this.repo.save(game);
  }

  /**
   * Get current timer status (delegated to GameStatsService)
   */
  async getTimerStatus(id: string) {
    return this.statsService.getTimerStatus(id);
  }
}
