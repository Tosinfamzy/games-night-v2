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
  /**
   * Base query for game results scoped to a single games master — only results
   * from sessions this GM hosts. History and leaderboards are per-host: a GM
   * sees their own nights, never every tenant's games/players.
   */
  private gmResultsQuery(gamesMasterId: string) {
    return this.gameResultRepo
      .createQueryBuilder('gameResult')
      .leftJoinAndSelect('gameResult.game', 'game')
      .leftJoinAndSelect('gameResult.session', 'session')
      .leftJoinAndSelect('gameResult.winningTeam', 'winningTeam')
      .leftJoin('session.host', 'host')
      .where('host.id = :gamesMasterId', { gamesMasterId });
  }

  async getGameHistory(
    gamesMasterId: string,
    queryDto: QueryHistoryDto,
  ): Promise<GameResult[]> {
    const { sessionId, limit = 10, offset = 0 } = queryDto;

    const query = this.gmResultsQuery(gamesMasterId)
      .orderBy('gameResult.completedAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (sessionId) {
      query.andWhere('session.id = :sessionId', { sessionId });
    }

    return await query.getMany();
  }

  /**
   * Get a single game result by ID — scoped to the caller's own sessions.
   */
  async getGameResultById(
    gamesMasterId: string,
    id: string,
  ): Promise<GameResult> {
    const gameResult = await this.gameResultRepo.findOne({
      where: { id, session: { host: { id: gamesMasterId } } },
      relations: ['game', 'session', 'winningTeam'],
    });

    if (!gameResult) {
      throw new NotFoundException(`Game result with ID ${id} not found`);
    }

    return gameResult;
  }

  /**
   * Get statistics for a single player, within the caller's own sessions.
   */
  async getPlayerStats(
    gamesMasterId: string,
    playerId: string,
  ): Promise<PlayerStatsDto> {
    const player = await this.playerRepo.findOne({
      where: { id: playerId },
      relations: ['teams'],
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${playerId} not found`);
    }

    const results = await this.gmResultsQuery(gamesMasterId)
      .orderBy('gameResult.completedAt', 'DESC')
      .getMany();

    return this.buildPlayerStats(player, results);
  }

  /**
   * Compute a player's stats from pre-loaded game results.
   *
   * A player participates in a team game through their team(s), and in an
   * individual game directly. finalScores entries are keyed by team id (team
   * mode) or by the player's own id (individual mode), so we match on either.
   * `results` must be ordered by completedAt DESC and have `winningTeam` loaded.
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
      const playerScore = result.finalScores.find(
        (s) => s.teamId === player.id || teamIds.has(s.teamId),
      );
      if (!playerScore) {
        continue;
      }

      gamesPlayed++;
      totalScore += playerScore.score;
      // Team win: the player's team is the winning team. Individual win: the
      // player's own entry took rank 1 in a non-tied game (no winning team FK).
      const teamWin =
        result.winningTeam != null &&
        playerScore.teamId === result.winningTeam.id;
      const individualWin =
        playerScore.entrantType === 'player' &&
        playerScore.teamId === player.id &&
        playerScore.rank === 1 &&
        !result.isTied;
      if (teamWin || individualWin) {
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
  async getLeaderboard(
    gamesMasterId: string,
    limit: number = 10,
  ): Promise<PlayerStatsDto[]> {
    // Load players (with their teams) and this GM's results once, then compute
    // in memory. Players who never played in this GM's sessions get 0 games and
    // are filtered out below, so the board is naturally per-host.
    const players = await this.playerRepo.find({ relations: ['teams'] });
    const results = await this.gmResultsQuery(gamesMasterId)
      .orderBy('gameResult.completedAt', 'DESC')
      .getMany();

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

    // Idempotent: a game has exactly one result record. If two completions race
    // (or a game is re-completed), return the existing row instead of inserting
    // a duplicate (also enforced by a unique constraint on game_result.gameId).
    const existing = await this.gameResultRepo.findOne({
      where: { game: { id: gameId } },
    });
    if (existing) {
      return existing;
    }

    if (!game.completedAt || !game.results) {
      throw new Error('Game must be completed before creating a result record');
    }

    // Calculate duration
    const startTime = game.createdAt.getTime();
    const endTime = game.completedAt.getTime();
    const durationMinutes = Math.round((endTime - startTime) / 1000 / 60);

    // Build final scores from game results. entrantType carries through so an
    // individual game's entries are recognisable as players, not teams.
    const finalScores = game.results.standings.map((standing) => ({
      teamId: standing.teamId,
      teamName: standing.teamName,
      entrantType: standing.entrantType ?? 'team',
      score: standing.totalPoints,
      rank: standing.rank,
    }));

    // The winning team FK only resolves in team mode; the winner *name* is
    // recorded for both modes (in individual mode winnerId is a player id, whose
    // name is the rank-1 standing's teamName slot).
    let winningTeam: Team | undefined;
    let winningTeamName: string | undefined;
    if (game.winnerId && !game.results.isTied) {
      winningTeam = game.teams.find((team) => team.id === game.winnerId);
      winningTeamName = game.results.standings.find(
        (s) => s.teamId === game.winnerId,
      )?.teamName;
    }

    const gameResult = this.gameResultRepo.create({
      game,
      session: game.session,
      gameName: game.name,
      winningTeam,
      winningTeamName,
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
