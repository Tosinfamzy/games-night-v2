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
