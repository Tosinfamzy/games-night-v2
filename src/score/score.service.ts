import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { findOneOrThrow } from '../common/utils/find-or-throw.util';
import { Score } from './score.entity';
import { CreateScoreDto } from './dto/create-score.dto';
import { UpdateScoreDto } from './dto/update-score.dto';
import { Game } from '../game/game.entity';
import { Team } from '../team/team.entity';
import { Player } from '../player/player.entity';
import { SubmitGameScoreDto } from './dto/submit-game-score.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GameStatus } from '../game/enums/game-status.enum';
import { TeamScore } from './interfaces/team-score.interface';
import { TeamStandingDto } from '../common/dto/team-standing.dto';

interface RawTeamScore {
  teamId: string;
  teamName: string;
  totalPoints: string;
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
      relations: ['session'],
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${dto.gameId} not found`);
    }

    if (game.status !== GameStatus.ROUND_IN_PROGRESS) {
      throw new BadRequestException(
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
      relations: ['session'],
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${gameId} not found`);
    }

    if (game.status !== GameStatus.ROUND_IN_PROGRESS) {
      throw new BadRequestException(
        'Scores can only be submitted during an active round',
      );
    }

    const team = await this.teamRepo.findOne({
      where: { id: dto.teamId },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${dto.teamId} not found`);
    }

    const score = this.repo.create({
      points: dto.score,
      game,
      team,
      roundNumber: dto.roundNumber || game.currentRound,
    });

    const savedScore = await this.repo.save(score);
    this.eventEmitter.emit('score.submitted', {
      gameId,
      teamId: dto.teamId,
      points: dto.score,
      roundNumber: savedScore.roundNumber,
    });

    return savedScore;
  }

  async getGameScores(gameId: string): Promise<TeamScore[]> {
    const rawScores = await this.repo
      .createQueryBuilder('score')
      .leftJoin('score.team', 'team')
      .leftJoin('score.game', 'game')
      .where('game.id = :gameId', { gameId })
      .select([
        'team.id as "teamId"',
        'team.name as "teamName"',
        'CAST(SUM(score.points) AS INTEGER) as "totalPoints"',
        'CAST(COUNT(CASE WHEN score.isBonus THEN 1 END) AS INTEGER) as "bonusPointsCount"',
        'score.roundNumber as "roundNumber"',
        'CAST(SUM(score.points) AS INTEGER) as "roundPoints"',
      ])
      .groupBy('team.id, team.name, score.roundNumber')
      .getRawMany<RawTeamScore>();

    // Transform the raw results into the desired format
    const teamScoresMap = new Map<string, TeamScore>();

    for (const score of rawScores) {
      if (!teamScoresMap.has(score.teamId)) {
        teamScoresMap.set(score.teamId, {
          teamId: score.teamId,
          teamName: score.teamName,
          totalPoints: parseInt(score.totalPoints, 10) || 0,
          bonusPointsCount: parseInt(score.bonusPointsCount, 10) || 0,
          roundPoints: {},
        });
      }

      const teamScore = teamScoresMap.get(score.teamId)!;
      teamScore.roundPoints[score.roundNumber] =
        parseInt(score.roundPoints, 10) || 0;
    }

    return Array.from(teamScoresMap.values());
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

    // Second pass: determine winners for each game
    const gameWinnersMap = new Map<string, string>();
    const gamePointsMap = new Map<string, number>();

    for (const [, team] of teamMap) {
      for (const [gameId, points] of Object.entries(team.gamePoints)) {
        const currentMax = gamePointsMap.get(gameId) || 0;
        if (points > currentMax) {
          gamePointsMap.set(gameId, points);
          gameWinnersMap.set(gameId, team.teamId);
        } else if (points === currentMax) {
          // Tie - remove winner
          gameWinnersMap.delete(gameId);
        }
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
