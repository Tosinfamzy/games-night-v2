import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../game.entity';
import { TeamService } from '../../team/team.service';
import { ScoreService } from '../../score/score.service';
import { GameStatus } from '../enums/game-status.enum';
import { GameResultsDto } from '../../common/dto/game-results.dto';
import { GameStats } from '../interfaces/game.interface';

@Injectable()
export class GameStatsService {
  constructor(
    @InjectRepository(Game)
    private readonly repo: Repository<Game>,
    @Inject(forwardRef(() => TeamService))
    private readonly teamService: TeamService,
    @Inject(forwardRef(() => ScoreService))
    private readonly scoreService: ScoreService,
  ) {}

  /**
   * Get comprehensive game statistics
   */
  async getGameStats(id: string): Promise<GameStats> {
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
   * Get game results with standings
   */
  async getResults(id: string): Promise<GameResultsDto> {
    const game = await this.findOne(id);

    // Get standings from score service
    const standings = await this.scoreService.getRankedGameScores(id);
    const winner = await this.scoreService.determineWinner(id);

    // Check if there's a tie for first place
    const isTied =
      standings.length > 0 && standings.filter((s) => s.rank === 1).length > 1;

    return {
      gameId: game.id,
      gameName: game.name,
      status: game.status,
      winnerId: game.winnerId || null,
      winnerName: winner?.winnerName || null,
      winningScore: winner?.score || null,
      completedAt: game.completedAt?.toISOString() || null,
      standings,
      roundsCompleted: game.currentRound,
      isTied,
    };
  }

  /**
   * Get current timer status for a game
   */
  async getTimerStatus(id: string) {
    const game = await this.findOne(id);

    if (!game.turnStartedAt) {
      return {
        gameId: game.id,
        currentTurnTeamId: game.currentTurnTeamId,
        currentTurnTeamName: null,
        turnStartedAt: null,
        turnTimeLimit: game.turnTimeLimit,
        elapsedSeconds: 0,
        remainingSeconds: game.turnTimeLimit,
        isExpired: false,
        percentageUsed: null,
      };
    }

    const elapsedMs = Date.now() - game.turnStartedAt.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    let remainingSeconds: number | null = null;
    let isExpired = false;
    let percentageUsed: number | null = null;

    if (game.turnTimeLimit) {
      remainingSeconds = Math.max(0, game.turnTimeLimit - elapsedSeconds);
      isExpired = remainingSeconds === 0;
      percentageUsed = Math.min(
        100,
        (elapsedSeconds / game.turnTimeLimit) * 100,
      );
    }

    // Get current team name
    const teams = await this.teamService.findByGame(id);
    const currentTeam = teams.find(
      (team) => team.id === game.currentTurnTeamId,
    );

    return {
      gameId: game.id,
      currentTurnTeamId: game.currentTurnTeamId,
      currentTurnTeamName: currentTeam?.name || null,
      turnStartedAt: game.turnStartedAt,
      turnTimeLimit: game.turnTimeLimit,
      elapsedSeconds,
      remainingSeconds,
      isExpired,
      percentageUsed,
    };
  }

  /**
   * Helper: Find a game by ID
   */
  private async findOne(id: string): Promise<Game> {
    const game = await this.repo.findOne({
      where: { id },
      relations: ['session', 'teams', 'scores', 'gameLibrary'],
    });

    if (!game) {
      throw new Error(`Game with ID ${id} not found`);
    }

    return game;
  }
}
