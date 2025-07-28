import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

    // Enhanced validation for score submission
    if (game.status !== GameStatus.ROUND_IN_PROGRESS) {
      throw new BadRequestException(
        'Scores can only be submitted during an active round',
      );
    }

    // Validate score constraints
    this.validateScoreConstraints(dto, game);

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
      const team = await this.teamRepo.findOne({
        where: { id: dto.teamId },
        relations: ['game'],
      });
      if (!team) {
        throw new NotFoundException(`Team with ID ${dto.teamId} not found`);
      }

      // Verify team belongs to the same game
      if (team.game.id !== dto.gameId) {
        throw new BadRequestException(
          'Team does not belong to the specified game',
        );
      }

      score.team = team;
    }

    const savedScore = await this.repo.save(score);

    // Emit event for real-time updates
    this.eventEmitter.emit('score.created', {
      gameId: dto.gameId,
      teamId: dto.teamId,
      playerId: dto.playerId,
      points: dto.points,
      roundNumber: game.currentRound,
      isBonus: dto.isBonus,
    });

    return savedScore;
  }

  /**
   * Validates score constraints and business rules
   */
  private validateScoreConstraints(dto: CreateScoreDto, game: Game): void {
    // Validate score range
    if (dto.points < 0) {
      throw new BadRequestException('Score cannot be negative');
    }

    if (dto.points > 1000) {
      throw new BadRequestException('Score cannot exceed 1000 points');
    }

    // Validate that either playerId or teamId is provided
    if (!dto.playerId && !dto.teamId) {
      throw new BadRequestException(
        'Either playerId or teamId must be provided',
      );
    }

    // Validate round constraints
    if (game.currentRound <= 0) {
      throw new BadRequestException('Invalid round number');
    }

    if (game.maxRounds && game.currentRound > game.maxRounds) {
      throw new BadRequestException('Game has exceeded maximum rounds');
    }
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

  /**
   * Advanced round progression with validation
   */
  async progressToNextRound(gameId: string): Promise<{
    success: boolean;
    newRound: number;
    roundSummary: {
      totalScores: number;
      teamsScored: number;
      averageScore: number;
    };
  }> {
    const game = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ['session'],
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${gameId} not found`);
    }

    if (game.status !== GameStatus.ROUND_IN_PROGRESS) {
      throw new BadRequestException('Can only progress from an active round');
    }

    if (game.maxRounds && game.currentRound >= game.maxRounds) {
      throw new BadRequestException('Game has already reached maximum rounds');
    }

    // Get current round scores for summary
    const currentRoundScores = await this.repo.find({
      where: {
        game: { id: gameId },
        roundNumber: game.currentRound,
      },
      relations: ['team'],
    });

    const roundSummary = {
      totalScores: currentRoundScores.reduce(
        (sum, score) => sum + score.points,
        0,
      ),
      teamsScored: new Set(currentRoundScores.map((score) => score.team?.id))
        .size,
      averageScore:
        currentRoundScores.length > 0
          ? currentRoundScores.reduce((sum, score) => sum + score.points, 0) /
            currentRoundScores.length
          : 0,
    };

    // Progress to next round
    game.currentRound += 1;
    game.status =
      game.currentRound <= (game.maxRounds || Infinity)
        ? GameStatus.ROUND_IN_PROGRESS
        : GameStatus.COMPLETED;

    await this.gameRepo.save(game);

    // Emit event for real-time updates
    this.eventEmitter.emit('round.progressed', {
      gameId,
      newRound: game.currentRound,
      status: game.status,
      roundSummary,
    });

    return {
      success: true,
      newRound: game.currentRound,
      roundSummary,
    };
  }

  /**
   * Get comprehensive score history for a game
   */
  async getScoreHistory(gameId: string): Promise<{
    gameInfo: {
      id: string;
      currentRound: number;
      maxRounds: number;
      status: string;
    };
    rounds: Array<{
      roundNumber: number;
      scores: Array<{
        teamId: string;
        teamName: string;
        points: number;
        isBonus: boolean;
        timestamp: Date;
      }>;
      roundTotal: number;
      roundAverage: number;
    }>;
    leaderboard: Array<{
      teamId: string;
      teamName: string;
      totalPoints: number;
      roundsPlayed: number;
      averagePerRound: number;
      position: number;
    }>;
  }> {
    const game = await this.gameRepo.findOne({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${gameId} not found`);
    }

    const allScores = await this.repo.find({
      where: { game: { id: gameId } },
      relations: ['team'],
      order: { roundNumber: 'ASC', createdAt: 'ASC' },
    });

    // Group scores by round
    const roundsMap = new Map<
      number,
      Array<{
        teamId: string;
        teamName: string;
        points: number;
        isBonus: boolean;
        timestamp: Date;
      }>
    >();
    const teamTotals = new Map<
      string,
      {
        teamName: string;
        totalPoints: number;
        roundsPlayed: Set<number>;
      }
    >();

    for (const score of allScores) {
      // Skip scores without teams
      if (!score.team?.id || !score.team?.name) {
        continue;
      }

      const roundNumber = score.roundNumber;

      if (!roundsMap.has(roundNumber)) {
        roundsMap.set(roundNumber, []);
      }

      roundsMap.get(roundNumber)!.push({
        teamId: score.team.id,
        teamName: score.team.name,
        points: score.points,
        isBonus: score.isBonus,
        timestamp: score.createdAt,
      });

      // Update team totals
      const teamId = score.team.id;
      const teamName = score.team.name;
      if (!teamTotals.has(teamId)) {
        teamTotals.set(teamId, {
          teamName: teamName,
          totalPoints: 0,
          roundsPlayed: new Set(),
        });
      }

      const teamData = teamTotals.get(teamId)!;
      teamData.totalPoints += score.points;
      teamData.roundsPlayed.add(roundNumber);
    }

    // Build rounds array
    const rounds = Array.from(roundsMap.entries())
      .map(([roundNumber, scores]) => ({
        roundNumber,
        scores,
        roundTotal: scores.reduce((sum, score) => sum + score.points, 0),
        roundAverage:
          scores.length > 0
            ? scores.reduce((sum, score) => sum + score.points, 0) /
              scores.length
            : 0,
      }))
      .sort((a, b) => a.roundNumber - b.roundNumber);

    // Build leaderboard
    const leaderboard = Array.from(teamTotals.entries())
      .map(([teamId, data]) => ({
        teamId,
        teamName: data.teamName,
        totalPoints: data.totalPoints,
        roundsPlayed: data.roundsPlayed.size,
        averagePerRound:
          data.roundsPlayed.size > 0
            ? data.totalPoints / data.roundsPlayed.size
            : 0,
        position: 0, // Will be set after sorting
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((team, index) => ({ ...team, position: index + 1 }));

    return {
      gameInfo: {
        id: game.id,
        currentRound: game.currentRound,
        maxRounds: game.maxRounds,
        status: game.status,
      },
      rounds,
      leaderboard,
    };
  }

  /**
   * Validate and adjust scores (for corrections)
   */
  async adjustScore(
    scoreId: string,
    adjustment: { points?: number; reason: string },
  ): Promise<Score> {
    const score = await this.repo.findOne({
      where: { id: scoreId },
      relations: ['game', 'team', 'player'],
    });

    if (!score) {
      throw new NotFoundException(`Score with ID ${scoreId} not found`);
    }

    if (score.game.status === GameStatus.COMPLETED) {
      throw new BadRequestException('Cannot adjust scores for completed games');
    }

    const oldPoints = score.points;

    if (adjustment.points !== undefined) {
      if (adjustment.points < 0) {
        throw new BadRequestException('Adjusted score cannot be negative');
      }
      score.points = adjustment.points;
    }

    const adjustedScore = await this.repo.save(score);

    // Emit event for adjustment tracking
    this.eventEmitter.emit('score.adjusted', {
      scoreId,
      gameId: score.game.id,
      teamId: score.team?.id,
      oldPoints,
      newPoints: score.points,
      reason: adjustment.reason,
      adjustedAt: new Date(),
    });

    return adjustedScore;
  }

  async findOne(id: string): Promise<Score> {
    const score = await this.repo.findOne({
      where: { id },
      relations: ['game', 'team', 'player'],
    });

    if (!score) {
      throw new NotFoundException(`Score with ID ${id} not found`);
    }

    return score;
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
}
