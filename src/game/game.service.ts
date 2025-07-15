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
import { Session } from '../session/session.entity';
import { Team } from '../team/team.entity';
import { GameStatus } from './enums/game-status.enum';

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(Game)
    private readonly repo: Repository<Game>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
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
}
