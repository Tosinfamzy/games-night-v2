import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameResult } from './game-result.entity';
import { QueryHistoryDto } from './dto/query-history.dto';
import { PlayerStatsDto } from './dto/player-stats.dto';
import { Game } from '../game/game.entity';
import { Session } from '../session/session.entity';
import { Team } from '../team/team.entity';
import { Player } from '../player/player.entity';
import { Score } from '../score/score.entity';

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(GameResult)
    private readonly gameResultRepo: Repository<GameResult>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    @InjectRepository(Score)
    private readonly scoreRepo: Repository<Score>,
  ) {}

  /**
   * Get game history with optional filters
   */
  async getGameHistory(queryDto: QueryHistoryDto): Promise<GameResult[]> {
    const { sessionId, limit = 10, offset = 0 } = queryDto;

    const query = this.gameResultRepo
      .createQueryBuilder('gameResult')
      .leftJoinAndSelect('gameResult.game', 'game')
      .leftJoinAndSelect('gameResult.session', 'session')
      .leftJoinAndSelect('gameResult.winningTeam', 'winningTeam')
      .orderBy('gameResult.completedAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (sessionId) {
      query.where('session.id = :sessionId', { sessionId });
    }

    return await query.getMany();
  }

  /**
   * Get a single game result by ID
   */
  async getGameResultById(id: string): Promise<GameResult> {
    const gameResult = await this.gameResultRepo.findOne({
      where: { id },
      relations: ['game', 'session', 'winningTeam'],
    });

    if (!gameResult) {
      throw new NotFoundException(`Game result with ID ${id} not found`);
    }

    return gameResult;
  }

  /**
   * Get statistics for a single player.
   */
  async getPlayerStats(playerId: string): Promise<PlayerStatsDto> {
    const player = await this.playerRepo.findOne({
      where: { id: playerId },
      relations: ['teams'],
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${playerId} not found`);
    }

    const results = await this.gameResultRepo.find({
      relations: ['winningTeam'],
      order: { completedAt: 'DESC' },
    });

    return this.buildPlayerStats(player, results);
  }

  /**
   * Compute a player's stats from pre-loaded game results.
   *
   * A player participates in a game through their team(s); finalScores records
   * per-team scores, so we match the player's team ids against each result's
   * finalScores. `results` must be ordered by completedAt DESC and have
   * `winningTeam` loaded.
   */
  private buildPlayerStats(
    player: Player,
    results: GameResult[],
  ): PlayerStatsDto {
    const teamIds = new Set((player.teams ?? []).map((team) => team.id));

    let gamesPlayed = 0;
    let gamesWon = 0;
    let totalScore = 0;
    let lastPlayedAt: Date | undefined;
    const gameCounts = new Map<string, number>();

    for (const result of results) {
      const playerScore = result.finalScores.find((s) => teamIds.has(s.teamId));
      if (!playerScore) {
        continue;
      }

      gamesPlayed++;
      totalScore += playerScore.score;
      if (result.winningTeam && playerScore.teamId === result.winningTeam.id) {
        gamesWon++;
      }
      gameCounts.set(
        result.gameName,
        (gameCounts.get(result.gameName) ?? 0) + 1,
      );
      if (!lastPlayedAt) {
        lastPlayedAt = result.completedAt; // results are DESC; first match is latest
      }
    }

    let favoriteGame: string | undefined;
    let maxCount = 0;
    for (const [gameName, count] of gameCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        favoriteGame = gameName;
      }
    }

    return {
      playerId: player.id,
      playerName: player.name,
      gamesPlayed,
      gamesWon,
      winRate: gamesPlayed > 0 ? gamesWon / gamesPlayed : 0,
      totalScore,
      averageScore: gamesPlayed > 0 ? totalScore / gamesPlayed : 0,
      favoriteGame,
      lastPlayedAt: lastPlayedAt?.toISOString(),
    };
  }

  /**
   * Get leaderboard (top players by win rate, then games won).
   */
  async getLeaderboard(limit: number = 10): Promise<PlayerStatsDto[]> {
    // Load players (with their teams) and all results once, then compute in
    // memory — avoids an N+1 query over the player table.
    const players = await this.playerRepo.find({ relations: ['teams'] });
    const results = await this.gameResultRepo.find({
      relations: ['winningTeam'],
      order: { completedAt: 'DESC' },
    });

    return players
      .map((player) => this.buildPlayerStats(player, results))
      .filter((stats) => stats.gamesPlayed > 0)
      .sort((a, b) =>
        b.winRate !== a.winRate
          ? b.winRate - a.winRate
          : b.gamesWon - a.gamesWon,
      )
      .slice(0, limit);
  }

  /**
   * Create a game result when a game is completed
   * This should be called from the game service when a game ends
   */
  async createGameResult(gameId: string): Promise<GameResult> {
    const game = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ['session', 'teams', 'scores'],
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${gameId} not found`);
    }

    if (!game.completedAt || !game.results) {
      throw new Error('Game must be completed before creating a result record');
    }

    // Calculate duration
    const startTime = game.createdAt.getTime();
    const endTime = game.completedAt.getTime();
    const durationMinutes = Math.round((endTime - startTime) / 1000 / 60);

    // Build final scores from game results
    const finalScores = game.results.standings.map((standing) => ({
      teamId: standing.teamId,
      teamName: standing.teamName,
      score: standing.totalPoints,
      rank: standing.rank,
    }));

    // Find winning team
    let winningTeam: Team | undefined;
    if (game.winnerId && !game.results.isTied) {
      winningTeam = game.teams.find((team) => team.id === game.winnerId);
    }

    const gameResult = this.gameResultRepo.create({
      game,
      session: game.session,
      gameName: game.name,
      winningTeam,
      winningTeamName: winningTeam?.name,
      finalScores,
      completedAt: game.completedAt,
      durationMinutes,
      totalRounds: game.currentRound,
      teamCount: game.teams.length,
      isTied: game.results.isTied,
    });

    return await this.gameResultRepo.save(gameResult);
  }
}
