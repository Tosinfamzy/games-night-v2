import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { findOneOrThrow } from '../common/utils/find-or-throw.util';
import { DomainError } from '../common/errors/domain-errors';
import { Score } from './score.entity';
import { CreateScoreDto } from './dto/create-score.dto';
import { UpdateScoreDto } from './dto/update-score.dto';
import { Game } from '../game/game.entity';
import { Team } from '../team/team.entity';
import { Player } from '../player/player.entity';
import { SubmitGameScoreDto } from './dto/submit-game-score.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GameStatus } from '../game/enums/game-status.enum';
import { ScoreMode } from '../game/enums/score-mode.enum';
import { TeamScore } from './interfaces/team-score.interface';
import { TeamStandingDto } from '../common/dto/team-standing.dto';

interface RawTeamScore {
  teamId: string;
  teamName: string;
  bonusPointsCount: string;
  roundNumber: number;
  roundPoints: string;
}

@Injectable()
export class ScoreService {
  constructor(
    @InjectRepository(Score)
    private readonly repo: Repository<Score>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateScoreDto): Promise<Score> {
    const game = await this.gameRepo.findOne({
      where: { id: dto.gameId },
      relations: ['session', 'teams'],
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${dto.gameId} not found`);
    }

    if (game.status !== GameStatus.ROUND_IN_PROGRESS) {
      throw DomainError.roundNotActive(
        'Scores can only be submitted during an active round',
      );
    }

    const score = this.repo.create({
      points: dto.points,
      isBonus: dto.isBonus || false,
      game,
      roundNumber: game.currentRound,
    });

    if (dto.playerId) {
      const player = await this.playerRepo.findOneBy({ id: dto.playerId });
      if (!player) {
        throw new NotFoundException(`Player with ID ${dto.playerId} not found`);
      }
      score.player = player;
    }

    if (dto.teamId) {
      const team = await this.teamRepo.findOneBy({ id: dto.teamId });
      if (!team) {
        throw new NotFoundException(`Team with ID ${dto.teamId} not found`);
      }
      // The team must be one of this game's teams.
      if (!(game.teams ?? []).some((t) => t.id === dto.teamId)) {
        throw DomainError.gameInvalidState('Team is not part of this game');
      }
      score.team = team;
    }

    return await this.repo.save(score);
  }

  async submitGameScore(
    gameId: string,
    dto: SubmitGameScoreDto,
  ): Promise<Score> {
    const game = await this.gameRepo.findOne({
      where: { id: gameId },
      // session.players is needed to validate an individual-mode entrant.
      relations: ['session', 'teams', 'session.players'],
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${gameId} not found`);
    }

    if (game.status !== GameStatus.ROUND_IN_PROGRESS) {
      throw DomainError.roundNotActive(
        'Scores can only be submitted during an active round',
      );
    }

    const score = this.repo.create({
      points: dto.score,
      game,
      // Always the server's current round: a client-supplied roundNumber could
      // otherwise backfill or double-count points against a past/future round.
      roundNumber: game.currentRound,
    });

    let entrantType: 'team' | 'player';
    let entrantId: string;

    if (game.scoreMode === ScoreMode.INDIVIDUAL) {
      if (!dto.playerId) {
        throw DomainError.gameInvalidState(
          'playerId is required for an individual-mode game',
        );
      }
      // The player must belong to THIS game's session — not merely exist —
      // otherwise a host could score someone playing elsewhere.
      const player = (game.session?.players ?? []).find(
        (p) => p.id === dto.playerId,
      );
      if (!player) {
        throw DomainError.gameInvalidState(
          'Player is not part of this game’s session',
        );
      }
      score.player = player;
      entrantType = 'player';
      entrantId = player.id;
    } else {
      if (!dto.teamId) {
        throw DomainError.gameInvalidState(
          'teamId is required for a team-mode game',
        );
      }
      const team = await this.teamRepo.findOne({ where: { id: dto.teamId } });
      if (!team) {
        throw new NotFoundException(`Team with ID ${dto.teamId} not found`);
      }
      // The team must be one of THIS game's teams — not merely in the same
      // session — otherwise a host could score a team playing a different game.
      if (!(game.teams ?? []).some((t) => t.id === dto.teamId)) {
        throw DomainError.gameInvalidState('Team is not part of this game');
      }
      score.team = team;
      entrantType = 'team';
      entrantId = team.id;
    }

    const savedScore = await this.repo.save(score);
    this.eventEmitter.emit('score.submitted', {
      gameId,
      entrantType,
      entrantId,
      teamId: score.team?.id,
      playerId: score.player?.id,
      points: dto.score,
      roundNumber: savedScore.roundNumber,
    });

    return savedScore;
  }

  async getGameScores(gameId: string): Promise<TeamScore[]> {
    const game = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ['teams'],
    });

    // Individual games have no fixed roster (a 1-v-1 lives inside a larger
    // session), so entrants are the players who have actually scored — seeded
    // from the score rows — not every player in the session.
    return game?.scoreMode === ScoreMode.INDIVIDUAL
      ? this.aggregateByEntrant(gameId, 'player', [])
      : this.aggregateByEntrant(gameId, 'team', game?.teams ?? []);
  }

  /**
   * Aggregate a game's scores by entrant — team or individual player. Both use
   * the same shape (`TeamScore`); for a player entrant, teamId/teamName carry
   * the player's id/name and entrantType is 'player'. Every entrant is seeded at
   * 0 first, so one that hasn't scored (or is negative) still ranks correctly
   * rather than a lower entrant being "crowned" over a 0 with no rows.
   */
  private async aggregateByEntrant(
    gameId: string,
    entrantType: 'team' | 'player',
    entrants: Array<{ id: string; name: string }>,
  ): Promise<TeamScore[]> {
    const scoresMap = new Map<string, TeamScore>();
    for (const entrant of entrants) {
      scoresMap.set(entrant.id, {
        teamId: entrant.id,
        teamName: entrant.name,
        entrantType,
        totalPoints: 0,
        bonusPointsCount: 0,
        roundPoints: {},
      });
    }

    const relation = entrantType === 'player' ? 'score.player' : 'score.team';
    const rawScores = await this.repo
      .createQueryBuilder('score')
      .leftJoin(relation, 'entrant')
      .leftJoin('score.game', 'game')
      .where('game.id = :gameId', { gameId })
      .select([
        'entrant.id as "teamId"',
        'entrant.name as "teamName"',
        'CAST(COUNT(CASE WHEN score.isBonus THEN 1 END) AS INTEGER) as "bonusPointsCount"',
        'score.roundNumber as "roundNumber"',
        'CAST(SUM(score.points) AS INTEGER) as "roundPoints"',
      ])
      // One row per (entrant, round). totalPoints is summed across those rows in
      // the loop below — grouping by round means SUM() here is per-round only,
      // so the grand total must be accumulated, not read from a single row.
      .groupBy('entrant.id, entrant.name, score.roundNumber')
      .getRawMany<RawTeamScore>();

    for (const score of rawScores) {
      // Skip rows whose entrant is null (a score of the other kind — e.g. a
      // team-only score when aggregating players); they'd form a phantom group.
      if (score.teamId == null) {
        continue;
      }
      if (!scoresMap.has(score.teamId)) {
        // A score for an entrant not currently attached to the game (edge case).
        scoresMap.set(score.teamId, {
          teamId: score.teamId,
          teamName: score.teamName,
          entrantType,
          totalPoints: 0,
          bonusPointsCount: 0,
          roundPoints: {},
        });
      }

      const entrantScore = scoresMap.get(score.teamId)!;
      const roundPoints = parseInt(score.roundPoints, 10) || 0;
      entrantScore.roundPoints[score.roundNumber] = roundPoints;
      entrantScore.totalPoints += roundPoints;
      entrantScore.bonusPointsCount +=
        parseInt(score.bonusPointsCount, 10) || 0;
    }

    return Array.from(scoresMap.values());
  }

  /** Delete every score row for a game (used when resetting a game). */
  async deleteGameScores(gameId: string): Promise<void> {
    await this.repo.delete({ game: { id: gameId } });
  }

  async findOne(id: string): Promise<Score> {
    return findOneOrThrow(this.repo, { id }, `Score with ID ${id} not found`, [
      'game',
      'team',
      'player',
    ]);
  }

  async findAll(): Promise<Score[]> {
    return this.repo.find({
      relations: ['game', 'team', 'player'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, dto: UpdateScoreDto): Promise<Score> {
    const score = await this.findOne(id);

    // Only allow updating points and isBonus fields
    if (dto.points !== undefined) {
      score.points = dto.points;
    }
    if (dto.isBonus !== undefined) {
      score.isBonus = dto.isBonus;
    }

    return await this.repo.save(score);
  }

  async delete(id: string): Promise<void> {
    const score = await this.findOne(id);
    await this.repo.remove(score);
  }

  /**
   * Get ranked team standings for a game
   * Returns teams sorted by total points (highest to lowest) with rank assignments
   */
  async getRankedGameScores(gameId: string): Promise<TeamStandingDto[]> {
    const teamScores = await this.getGameScores(gameId);

    // Sort by total points (descending)
    const sortedScores = teamScores.sort(
      (a, b) => b.totalPoints - a.totalPoints,
    );

    // Assign ranks and detect ties
    const standings: TeamStandingDto[] = [];
    let currentRank = 1;

    for (let i = 0; i < sortedScores.length; i++) {
      const score = sortedScores[i];

      // Check if tied with previous team
      const isTied =
        i > 0 && sortedScores[i - 1].totalPoints === score.totalPoints;

      // If not tied with previous, update rank
      if (i > 0 && !isTied) {
        currentRank = i + 1;
      }

      standings.push({
        teamId: score.teamId,
        teamName: score.teamName,
        entrantType: score.entrantType,
        rank: currentRank,
        totalPoints: score.totalPoints,
        bonusPointsCount: score.bonusPointsCount,
        roundPoints: score.roundPoints,
        isTied,
      });
    }

    return standings;
  }

  /**
   * Determine the winner of a game
   * Returns null if there are no teams or if there's a tie for first place
   */
  async determineWinner(
    gameId: string,
  ): Promise<{ winnerId: string; winnerName: string; score: number } | null> {
    const standings = await this.getRankedGameScores(gameId);

    if (standings.length === 0) {
      return null;
    }

    const firstPlace = standings[0];

    // Check if there's a tie for first place
    const isTied = standings.some(
      (standing, index) =>
        index > 0 &&
        standing.totalPoints === firstPlace.totalPoints &&
        standing.rank === 1,
    );

    if (isTied) {
      // Return null for ties (can be enhanced with tie-breaking rules later)
      return null;
    }

    return {
      winnerId: firstPlace.teamId,
      winnerName: firstPlace.teamName,
      score: firstPlace.totalPoints,
    };
  }

  /**
   * Get session-wide leaderboard by aggregating scores across all session games
   */
  async getSessionLeaderboard(sessionId: string): Promise<
    Array<{
      teamId: string;
      teamName: string;
      totalPoints: number;
      gamesWon: number;
      gamesPlayed: number;
      gamePoints: Record<string, number>;
    }>
  > {
    const rawResults = await this.repo
      .createQueryBuilder('score')
      .leftJoin('score.team', 'team')
      .leftJoin('score.game', 'game')
      .leftJoin('game.session', 'session')
      .where('session.id = :sessionId', { sessionId })
      .select([
        'team.id as "teamId"',
        'team.name as "teamName"',
        'game.id as "gameId"',
        'CAST(SUM(score.points) AS INTEGER) as "gamePoints"',
      ])
      .groupBy('team.id, team.name, game.id')
      .getRawMany<{
        teamId: string;
        teamName: string;
        gameId: string;
        gamePoints: string;
      }>();

    // Aggregate by team
    const teamMap = new Map<
      string,
      {
        teamId: string;
        teamName: string;
        totalPoints: number;
        gamesWon: number;
        gamesPlayed: number;
        gamePoints: Record<string, number>;
      }
    >();

    // First pass: collect all game points per team
    for (const result of rawResults) {
      // Individual-mode scores have no team (team=null → null teamId); by design
      // they don't feed the team-based session leaderboard, so skip them rather
      // than collapsing them all into a phantom null "team".
      if (result.teamId == null) {
        continue;
      }
      if (!teamMap.has(result.teamId)) {
        teamMap.set(result.teamId, {
          teamId: result.teamId,
          teamName: result.teamName,
          totalPoints: 0,
          gamesWon: 0,
          gamesPlayed: 0,
          gamePoints: {},
        });
      }

      const team = teamMap.get(result.teamId)!;
      const points = parseInt(result.gamePoints, 10) || 0;
      team.gamePoints[result.gameId] = points;
      team.totalPoints += points;
      team.gamesPlayed++;
    }

    // Second pass: determine each game's winner. Collect every team's points
    // per game, then take the unique max — seeding from 0 (the old default)
    // meant an all-negative game had no winner and a real 0 could never win.
    const perGame = new Map<
      string,
      Array<{ teamId: string; points: number }>
    >();
    for (const [, team] of teamMap) {
      for (const [gameId, points] of Object.entries(team.gamePoints)) {
        const entries = perGame.get(gameId) ?? [];
        entries.push({ teamId: team.teamId, points });
        perGame.set(gameId, entries);
      }
    }

    const gameWinnersMap = new Map<string, string>();
    for (const [gameId, entries] of perGame) {
      const max = Math.max(...entries.map((e) => e.points));
      const leaders = entries.filter((e) => e.points === max);
      // Only a clear (untied) top team wins the game.
      if (leaders.length === 1) {
        gameWinnersMap.set(gameId, leaders[0].teamId);
      }
    }

    // Third pass: count wins
    for (const [, team] of teamMap) {
      for (const [gameId] of Object.entries(team.gamePoints)) {
        if (gameWinnersMap.get(gameId) === team.teamId) {
          team.gamesWon++;
        }
      }
    }

    return Array.from(teamMap.values()).sort(
      (a, b) => b.totalPoints - a.totalPoints,
    );
  }
}
