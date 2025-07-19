import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameLibrary } from './game-library.entity';
import { CreateGameLibraryDto } from './dto/create-game-library.dto';
import { UpdateGameLibraryDto } from './dto/update-game-library.dto';

@Injectable()
export class GameLibraryService implements OnModuleInit {
  constructor(
    @InjectRepository(GameLibrary)
    private readonly gameLibraryRepo: Repository<GameLibrary>,
  ) {}

  async onModuleInit() {
    // Seed initial games when the module starts
    await this.seedInitialGames();
  }

  private async seedInitialGames() {
    // Check if we already have games in the library
    const existingGames = await this.gameLibraryRepo.count();
    if (existingGames > 0) {
      return; // Already seeded
    }

    // Create Articulate as the first game
    const articulate: CreateGameLibraryDto = {
      name: 'Articulate',
      description:
        'A fun word-guessing game where teams compete to describe words without saying them directly. Players must get their teammates to guess words by describing them without using rhymes, sounds-like clues, or direct translations.',
      minPlayers: 4,
      maxPlayers: 12,
      estimatedDuration: 30,
      difficulty: 'Easy',
      categories: ['Word Game', 'Team Game', 'Party Game'],
      equipment: 'Articulate cards, Timer, Score pad',
      rules:
        'Teams take turns describing words while teammates guess. No rhyming, sounds-like, or direct translations allowed. Teams move around the board based on correct guesses.',
      isActive: true,
    };

    await this.create(articulate);
    console.log('✅ Game library seeded with Articulate');
  }

  async create(dto: CreateGameLibraryDto): Promise<GameLibrary> {
    const game = this.gameLibraryRepo.create(dto);
    return await this.gameLibraryRepo.save(game);
  }

  async findAll(): Promise<GameLibrary[]> {
    return this.gameLibraryRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findAllIncludingInactive(): Promise<GameLibrary[]> {
    return this.gameLibraryRepo.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<GameLibrary> {
    const game = await this.gameLibraryRepo.findOne({
      where: { id },
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${id} not found`);
    }

    return game;
  }

  async findByName(name: string): Promise<GameLibrary | null> {
    return this.gameLibraryRepo.findOne({
      where: { name },
    });
  }

  async findByCategory(category: string): Promise<GameLibrary[]> {
    return this.gameLibraryRepo
      .createQueryBuilder('game')
      .where('game.categories LIKE :category', { category: `%${category}%` })
      .andWhere('game.isActive = :isActive', { isActive: true })
      .orderBy('game.name', 'ASC')
      .getMany();
  }

  async findByPlayerCount(playerCount: number): Promise<GameLibrary[]> {
    return this.gameLibraryRepo
      .createQueryBuilder('game')
      .where('game.minPlayers <= :playerCount', { playerCount })
      .andWhere('game.maxPlayers >= :playerCount', { playerCount })
      .andWhere('game.isActive = :isActive', { isActive: true })
      .orderBy('game.name', 'ASC')
      .getMany();
  }

  async update(id: string, dto: UpdateGameLibraryDto): Promise<GameLibrary> {
    const game = await this.findOne(id);
    Object.assign(game, dto);
    return await this.gameLibraryRepo.save(game);
  }

  async remove(id: string): Promise<void> {
    const game = await this.findOne(id);
    await this.gameLibraryRepo.remove(game);
  }

  async deactivate(id: string): Promise<GameLibrary> {
    const game = await this.findOne(id);
    game.isActive = false;
    return await this.gameLibraryRepo.save(game);
  }

  async activate(id: string): Promise<GameLibrary> {
    const game = await this.findOne(id);
    game.isActive = true;
    return await this.gameLibraryRepo.save(game);
  }
}
