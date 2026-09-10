import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameLibrary } from './game-library.entity';
import { CreateGameLibraryDto } from './dto/create-game-library.dto';
import { UpdateGameLibraryDto } from './dto/update-game-library.dto';
import { INITIAL_GAMES } from './game-library.seed';
import { GameFormat } from './enums/game-format.enum';

@Injectable()
export class GameLibraryService implements OnModuleInit {
  private readonly logger = new Logger(GameLibraryService.name);

  constructor(
    @InjectRepository(GameLibrary)
    private readonly gameLibraryRepo: Repository<GameLibrary>,
  ) {}

  async onModuleInit() {
    // Seed initial games when the module starts
    await this.seedInitialGames();
  }

  private async seedInitialGames() {
    // Check and seed each game individually (idempotent seeding).
    for (const gameDto of INITIAL_GAMES) {
      const existingGame = await this.findByName(gameDto.name);
      if (!existingGame) {
        await this.create(gameDto);
        this.logger.log(`Game library seeded with ${gameDto.name}`);
        continue;
      }

      // Self-heal planning metadata for rows created before it existed, so the
      // seed stays the source of truth even if the backfill migration didn't
      // run. Only touches rows still at the schema defaults — never overwrites
      // a game that already carries planning values.
      if (this.hasDefaultPlanningMetadata(existingGame)) {
        await this.reconcilePlanningMetadata(existingGame, gameDto);
      } else {
        this.logger.debug(`${gameDto.name} already exists in game library`);
      }
    }
  }

  /** True when a row has no planning metadata beyond the entity defaults. */
  private hasDefaultPlanningMetadata(game: GameLibrary): boolean {
    return (
      game.format === GameFormat.ALL_TEAMS &&
      game.recommendedRounds === 1 &&
      game.playersPerRound == null &&
      game.minTeams == null &&
      game.winnerBonusPoints == null
    );
  }

  private async reconcilePlanningMetadata(
    game: GameLibrary,
    seed: CreateGameLibraryDto,
  ): Promise<void> {
    const seededPlanning =
      (seed.format != null && seed.format !== GameFormat.ALL_TEAMS) ||
      (seed.recommendedRounds != null && seed.recommendedRounds !== 1) ||
      seed.playersPerRound != null ||
      seed.minTeams != null ||
      seed.winnerBonusPoints != null;

    if (!seededPlanning) {
      // Seed also uses only defaults — nothing to reconcile.
      return;
    }

    game.format = seed.format ?? GameFormat.ALL_TEAMS;
    game.recommendedRounds = seed.recommendedRounds ?? 1;
    game.playersPerRound = seed.playersPerRound ?? null;
    game.minTeams = seed.minTeams ?? null;
    game.winnerBonusPoints = seed.winnerBonusPoints ?? null;
    await this.gameLibraryRepo.save(game);
    this.logger.log(`Backfilled planning metadata for ${game.name}`);
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
