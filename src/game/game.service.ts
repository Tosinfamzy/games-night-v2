import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
import { GameStatus } from './enums/game-status.enum';
import { CreateTeamsDto } from '../team/dto/team-formation.dto';

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
      relations: ['session', 'teams', 'scores'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Game> {
    const game = await this.repo.findOne({
      where: { id },
      relations: ['session', 'teams', 'scores'],
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

    return await this.repo.save(game);
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

    return await this.repo.save(game);
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

    return await this.repo.save(game);
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

    game.currentTurnTeamId = nextTeamId;
    game.turnStartedAt = new Date();

    return await this.repo.save(game);
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
    return await this.repo.save(game);
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
    return await this.repo.save(game);
  }

  /**
   * Get comprehensive game statistics
   */
  async getGameStats(id: string): Promise<any> {
    const game = await this.findOne(id);
    const teams = await this.teamService.getTeamStats(id);

    // Calculate turn duration if game is in progress
    let currentTurnDuration = 0;
    if (
      game.turnStartedAt &&
      (game.status === GameStatus.IN_PROGRESS ||
        game.status === GameStatus.ROUND_IN_PROGRESS)
    ) {
      currentTurnDuration = Math.floor(
        (new Date().getTime() - game.turnStartedAt.getTime()) / 1000,
      );
    }

    const currentTeam = teams.find(
      (team) => team.id === game.currentTurnTeamId,
    );

    return {
      gameId: game.id,
      gameName: game.name,
      status: game.status,
      currentRound: game.currentRound,
      maxRounds: game.maxRounds,
      teamsCount: teams.length,
      totalPlayers: teams.reduce((total, team) => total + team.playerCount, 0),
      currentTurn: currentTeam
        ? {
            teamId: currentTeam.id,
            teamName: currentTeam.name,
            teamColor: currentTeam.color,
            duration: currentTurnDuration,
            timeLimit: game.turnTimeLimit,
          }
        : null,
      teams: teams,
      gameLibrary: game.gameLibrary,
    };
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
}
