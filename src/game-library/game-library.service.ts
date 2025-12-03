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
    // Define initial games to seed
    const gamesToSeed: CreateGameLibraryDto[] = [
      {
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
      },
      {
        name: 'Cards Against Humanity',
        description:
          'A party game for horrible people. Each round, one player asks a question from a black card, and everyone else answers with their funniest white card. The judge picks their favorite answer, and that player wins the round.',
        minPlayers: 2,
        maxPlayers: 10,
        estimatedDuration: 45,
        difficulty: 'Easy',
        categories: ['Party Game', 'Card Game', 'Adult Humor'],
        equipment: 'Cards Against Humanity deck (black cards and white cards)',
        rules:
          'One player is the Card Czar each round. The Czar reads a black card question. All other players submit their funniest white card as an answer. The Czar picks their favorite, and that player gets a point. First to 5-7 points wins.',
        isActive: true,
      },
    ];

    // Check and seed each game individually (idempotent seeding)
    for (const gameDto of gamesToSeed) {
      const existingGame = await this.findByName(gameDto.name);
      if (!existingGame) {
        await this.create(gameDto);
        console.log(`✅ Game library seeded with ${gameDto.name}`);
      } else {
        console.log(`ℹ️  ${gameDto.name} already exists in game library`);
      }
    }
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
