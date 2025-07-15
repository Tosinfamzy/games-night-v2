import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './team.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Game } from '../game/game.entity';

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team)
    private readonly repo: Repository<Team>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
  ) {}

  async create(dto: CreateTeamDto): Promise<Team> {
    const game = await this.gameRepo.findOneBy({ id: dto.gameId });
    if (!game) {
      throw new NotFoundException(`Game with ID ${dto.gameId} not found`);
    }

    const team = this.repo.create({
      name: dto.name,
      game,
    });
    return await this.repo.save(team);
  }

  async findAll(relations: string[] = []): Promise<Team[]> {
    return this.repo.find({
      relations,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, relations: string[] = []): Promise<Team> {
    const team = await this.repo.findOne({
      where: { id },
      relations,
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    return team;
  }

  async update(id: string, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOne(id);

    if (dto.gameId) {
      const game = await this.gameRepo.findOneBy({ id: dto.gameId });
      if (!game) {
        throw new NotFoundException(`Game with ID ${dto.gameId} not found`);
      }
      team.game = game;
    }

    Object.assign(team, {
      name: dto.name ?? team.name,
    });

    return await this.repo.save(team);
  }

  async delete(id: string): Promise<void> {
    const team = await this.findOne(id);
    await this.repo.remove(team);
  }

  async findByGame(gameId: string): Promise<Team[]> {
    return this.repo.find({
      where: { game: { id: gameId } },
      order: { name: 'ASC' },
      relations: ['game', 'players'],
    });
  }
}
