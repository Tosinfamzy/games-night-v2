import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GamesMaster } from './games-master.entity';
import { CreateGamesMasterDto } from './dto/create-games-master.dto';
import { UpdateGamesMasterDto } from './dto/update-games-master.dto';

@Injectable()
export class GamesMasterService {
  constructor(
    @InjectRepository(GamesMaster)
    private readonly repo: Repository<GamesMaster>,
  ) {}

  async create(dto: CreateGamesMasterDto): Promise<GamesMaster> {
    const gm = this.repo.create(dto);
    return await this.repo.save(gm);
  }

  async findAll(relations: string[] = []): Promise<GamesMaster[]> {
    return this.repo.find({
      relations,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, relations: string[] = []): Promise<GamesMaster> {
    const gm = await this.repo.findOne({
      where: { id },
      relations,
    });

    if (!gm) {
      throw new NotFoundException(`GamesMaster with ID ${id} not found`);
    }

    return gm;
  }

  async update(id: string, dto: UpdateGamesMasterDto): Promise<GamesMaster> {
    const gm = await this.findOne(id);

    Object.assign(gm, {
      name: dto.name ?? gm.name,
    });

    return this.repo.save(gm);
  }

  async delete(id: string): Promise<void> {
    const gm = await this.findOne(id);
    await this.repo.remove(gm);
  }

  async findWithActiveSessions(id: string): Promise<GamesMaster> {
    const gm = await this.repo.findOne({
      where: { id },
      relations: ['sessions'],
      order: {
        sessions: { date: 'DESC' },
      },
    });

    if (!gm) {
      throw new NotFoundException(`GamesMaster with ID ${id} not found`);
    }

    return gm;
  }
}
