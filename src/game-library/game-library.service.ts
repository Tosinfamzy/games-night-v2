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
    // Define initial games to seed
    const gamesToSeed: CreateGameLibraryDto[] = [
      {
        name: 'Articulate',
        description:
          'A fun word-guessing game where teams compete to describe words without saying them directly. Players must get their teammates to guess words by describing them without using rhymes, sounds-like clues, or direct translations.',
        // Playable head-to-head (2 teams of 1) up to bigger groups.
        minPlayers: 2,
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
        name: 'UNO',
        description:
          'The classic fast-paced card game. Match the top card by color or number, use action cards to skip, reverse, and stack draws on your opponents, and shout "UNO!" when you are down to one card. First to empty their hand wins the round.',
        // Works head-to-head with just two players, so it's easy to jump into.
        minPlayers: 2,
        maxPlayers: 10,
        estimatedDuration: 20,
        difficulty: 'Easy',
        categories: ['Card Game', 'Family Game', 'Party Game'],
        equipment: 'UNO deck',
        rules:
          'Match the top card by colour or number, or play an action/wild card; draw when you cannot play. Call "UNO" when you have one card left. First to empty their hand wins the round — play as many rounds as you like and keep score here.',
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
      {
        name: 'UNO No Mercy',
        description:
          'The ruthless version of UNO — bigger draw penalties (Draw 6, Draw 10, Wild Draw 10), Skip-Everyone and Discard-All cards, stackable draws, and a mercy rule: hit 25 cards in your hand and you are out. Fast and brutal.',
        minPlayers: 2,
        maxPlayers: 10,
        estimatedDuration: 30,
        difficulty: 'Medium',
        categories: ['Card Game', 'Party Game'],
        equipment: 'UNO No Mercy deck',
        rules:
          'Match the top card by colour, number or symbol; play action cards to stack draw penalties and wreck opponents. Reach 25 cards in your hand and you are eliminated. Last player standing (or first to empty their hand) wins the round — keep score across rounds here.',
        isActive: true,
      },

      // ── Party games (team-scored) — award placement points per game:
      //    1st = 3, 2nd = 2, 3rd = 1 (Musical Cups pays the winner 5). ──
      {
        name: 'Musical Cups',
        description:
          "Musical chairs with cups. Everyone circles the table while music plays; when it stops, grab a cup. There's one fewer cup than players, so someone's always caught out. Remove a cup each round until one player remains.",
        minPlayers: 4,
        maxPlayers: 30,
        estimatedDuration: 10,
        difficulty: 'Easy',
        categories: ['Party Game', 'Elimination', 'Icebreaker'],
        equipment: 'Plastic cups (players − 1), a speaker',
        rules:
          'Music on → players circle the table → music stops → grab a cup. No cup = out; remove one cup each round. Last player standing wins — their team scores a headstart 5 points. With 20+ players, run 2 heats then a final.',
        isActive: true,
      },
      {
        name: 'Head, Shoulders, Knees & Cup',
        description:
          "A reaction scramble. Players run through 'heads, shoulders, knees…' and dive for a cup on 'CUP!'. With fewer cups than players, someone's always left empty-handed.",
        minPlayers: 4,
        maxPlayers: 24,
        estimatedDuration: 10,
        difficulty: 'Easy',
        categories: ['Party Game', 'Reaction', 'Team Game'],
        equipment: 'Plastic cups (one fewer than players in the wave)',
        rules:
          '6 play at once (2 per team) around cups = players − 1. Caller: "heads, shoulders, knees… CUP!" — grab; whoever is cupless is out; remove a cup and repeat to one winner. Run 2–3 waves; most wave wins places the teams.',
        isActive: true,
      },
      {
        name: 'Sing a Song with ___',
        description:
          'Call out a word; the first player to grab the mic and sing a real song containing that word scores a point for their team.',
        minPlayers: 4,
        maxPlayers: 30,
        estimatedDuration: 15,
        difficulty: 'Easy',
        categories: ['Party Game', 'Music', 'Team Game'],
        equipment: 'A microphone, a word list',
        rules:
          'Caller shouts a word → first to grab the mic and sing a real song containing it scores. 1 point per word, ~15–20 words. Most points places.',
        isActive: true,
      },
      {
        name: 'Karaoke — Keep Singing',
        description:
          'One singer from each team performs together; the track is cut at random and they must carry on in tune from memory. The last one still singing correctly wins the round.',
        minPlayers: 4,
        maxPlayers: 30,
        estimatedDuration: 15,
        difficulty: 'Medium',
        categories: ['Party Game', 'Music', 'Team Game'],
        equipment: 'A karaoke track with a way to pause, a microphone',
        rules:
          'One singer per team (all at once). Cut the track at random; they carry on from memory. Last singing correctly wins the round; if more than one survives, best of 3 songs. 5 rounds, 1 point each.',
        isActive: true,
      },
      {
        name: 'Flippy Cup → Tic-Tac-Toe',
        description:
          "Flip a cup upright, then place it on a 3×3 grid — you can cap an opponent's cup. First team to three in a row wins the board.",
        minPlayers: 4,
        maxPlayers: 24,
        estimatedDuration: 15,
        difficulty: 'Medium',
        categories: ['Party Game', 'Skill', 'Team Game'],
        equipment: 'Plastic cups, tape for a 3×3 grid',
        rules:
          'Flip a cup upright then place it on the grid (you may cap opponent cups). Three in a row wins the board. Play round-robin between the teams; most board wins places.',
        isActive: true,
      },
      {
        name: 'Candle Blow',
        description:
          'A row of candles with two lines marked across it. Each player gets one breath — reach the near line for 1 point, the far line for 2. Teams sum their turns.',
        minPlayers: 4,
        maxPlayers: 30,
        estimatedDuration: 10,
        difficulty: 'Easy',
        categories: ['Party Game', 'Team Game'],
        equipment: 'Tea-light candles, a long lighter, tape for two lines',
        rules:
          'One breath each. Reach the near line = 1 point, the far line = 2 points, short of both = 0. Three players per team, sum the points; highest total places. Fire safety: clear the area, tie back hair, keep water nearby.',
        isActive: true,
      },
      {
        name: "Don't Touch the Colour",
        description:
          'Coloured sticky notes cover a table. A colour is called; nominated players must grab any note except that colour. A wrong grab knocks that player out.',
        minPlayers: 4,
        maxPlayers: 30,
        estimatedDuration: 10,
        difficulty: 'Easy',
        categories: ['Party Game', 'Reaction', 'Elimination', 'Team Game'],
        equipment: 'Sticky notes in 4–5 colours',
        rules:
          'Each team nominates a player per round. Caller names a colour → grab any note EXCEPT that colour; a wrong grab is out. Last team with players left places 1st.',
        isActive: true,
      },
      {
        name: 'Heavy Drinkers',
        description:
          "Three cups — two normal, one 'rogue' (a spirit, or lemon juice). Three players from a team drink; the other teams have to guess who copped the rogue.",
        minPlayers: 6,
        maxPlayers: 30,
        estimatedDuration: 15,
        difficulty: 'Easy',
        categories: ['Party Game', 'Drinking', 'Team Game'],
        equipment:
          '3 cups per round, a spirit + mixers, and a non-alcoholic option',
        rules:
          'Three players from one team drink 2 normal + 1 rogue cup. The other two teams each confer and submit ONE guess of who had the rogue — a correct guess scores a point for that team. 3 rounds (each team drinks once). Always offer a non-alcoholic version.',
        isActive: true,
      },
      {
        name: 'Blind, Deaf & Mute',
        description:
          "A trio — one blindfolded, one in headphones, one who can't speak — must work together to make a cocktail. All teams race at once while a judge roams.",
        minPlayers: 6,
        maxPlayers: 30,
        estimatedDuration: 15,
        difficulty: 'Medium',
        categories: ['Party Game', 'Team Game', 'Finale'],
        equipment: 'Blindfolds + headphones per team, cocktail ingredients',
        rules:
          "Each team fields a trio: one blindfolded, one in headphones, one who can't speak. Together they make the house cocktail. All teams go at once with a judge roaming to enforce the rules. Best drink (result + speed) places 1st.",
        isActive: true,
      },
    ];

    // Check and seed each game individually (idempotent seeding)
    for (const gameDto of gamesToSeed) {
      const existingGame = await this.findByName(gameDto.name);
      if (!existingGame) {
        await this.create(gameDto);
        this.logger.log(`Game library seeded with ${gameDto.name}`);
      } else {
        this.logger.debug(`${gameDto.name} already exists in game library`);
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
