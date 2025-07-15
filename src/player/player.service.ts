import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './player.entity';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { Session } from '../session/session.entity';

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(Player)
    private readonly repo: Repository<Player>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
  ) {}

  async create(dto: CreatePlayerDto): Promise<Player> {
    const session = await this.sessionRepo.findOneBy({ id: dto.sessionId });
    if (!session) {
      throw new NotFoundException(`Session with ID ${dto.sessionId} not found`);
    }

    const player = this.repo.create({
      name: dto.name,
      session,
    });
    return await this.repo.save(player);
  }

  async findAll(relations: string[] = []): Promise<Player[]> {
    return this.repo.find({
      relations,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, relations: string[] = []): Promise<Player> {
    const player = await this.repo.findOne({
      where: { id },
      relations,
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }

    return player;
  }

  async update(id: string, dto: UpdatePlayerDto): Promise<Player> {
    const player = await this.findOne(id);

    if (dto.sessionId) {
      const session = await this.sessionRepo.findOneBy({ id: dto.sessionId });
      if (!session) {
        throw new NotFoundException(
          `Session with ID ${dto.sessionId} not found`,
        );
      }
      player.session = session;
    }

    Object.assign(player, {
      name: dto.name ?? player.name,
    });

    return await this.repo.save(player);
  }

  async delete(id: string): Promise<void> {
    const player = await this.findOne(id);
    await this.repo.remove(player);
  }

  async findBySession(sessionId: string): Promise<Player[]> {
    return this.repo.find({
      where: { session: { id: sessionId } },
      order: { name: 'ASC' },
    });
  }
}
