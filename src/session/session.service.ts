import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './session.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { GamesMaster } from '../games-master/games-master.entity';
import { SessionStatus } from './enums/session-status.enum';
import { Game } from '../game/game.entity';
import { GameStatus } from '../game/enums/game-status.enum';
import { generateJoinCode } from './utils/join-code.util';
import { JoinSessionDto } from './dto/join-session.dto';
import { GameLibrary } from '../game-library/game-library.entity';
import {
  AddGamesToSessionDto,
  RemoveGameFromSessionDto,
} from './dto/session-games.dto';
import { PlayerStatus } from '../player/player.entity';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private readonly repo: Repository<Session>,
    @InjectRepository(GamesMaster)
    private readonly gamesMasterRepo: Repository<GamesMaster>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(GameLibrary)
    private readonly gameLibraryRepo: Repository<GameLibrary>,
  ) {}

  async create(dto: CreateSessionDto): Promise<Session> {
    const host = await this.gamesMasterRepo.findOneBy({
      id: dto.gamesMasterId,
    });
    if (!host) {
      throw new NotFoundException(
        `GamesMaster with ID ${dto.gamesMasterId} not found`,
      );
    }

    // Generate unique join code
    let joinCode = generateJoinCode();
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const existingSession = await this.repo.findOne({
        where: { joinCode },
      });
      if (!existingSession) {
        isUnique = true;
      } else {
        joinCode = generateJoinCode();
        attempts++;
      }
    }

    if (!isUnique) {
      throw new BadRequestException('Failed to generate unique join code');
    }

    const session = this.repo.create({
      name: dto.name,
      description: dto.description,
      date: dto.date,
      location: dto.location,
      host,
      status: SessionStatus.SCHEDULED,
      joinCode,
    });
    return await this.repo.save(session);
  }

  async findByJoinCode(joinCode: string): Promise<Session> {
    const session = await this.repo.findOne({
      where: { joinCode },
      relations: ['host', 'players', 'teams', 'games'],
    });

    if (!session) {
      throw new NotFoundException(
        `Session with join code ${joinCode} not found`,
      );
    }

    return session;
  }

  async joinSession(
    dto: JoinSessionDto,
  ): Promise<{ session: Session; message: string }> {
    const session = await this.findByJoinCode(dto.joinCode);

    if (session.status === SessionStatus.COMPLETED) {
      throw new BadRequestException('Cannot join a completed session');
    }

    if (session.status === SessionStatus.CANCELLED) {
      throw new BadRequestException('Cannot join a cancelled session');
    }

    // Note: Player creation/assignment logic would go here
    // For now, we'll just return the session info
    return {
      session,
      message: `Successfully joined session hosted by ${session.host.name}`,
    };
  }

  async findAll(relations: string[] = []): Promise<Session[]> {
    return this.repo.find({
      relations,
      order: { date: 'DESC' },
    });
  }

  async findOne(id: string, relations: string[] = []): Promise<Session> {
    const session = await this.repo.findOne({
      where: { id },
      relations,
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    return session;
  }

  async startSession(sessionId: string): Promise<Session> {
    const startCheck = await this.canStartSession(sessionId);

    if (!startCheck.canStart) {
      throw new BadRequestException(
        `Cannot start session: ${startCheck.reasons.join(', ')}`,
      );
    }

    const session = await this.findOne(sessionId, ['players']);

    // Update session status
    session.status = SessionStatus.IN_PROGRESS;

    // Set all ready players to playing status
    const activePlayers = session.players.filter(
      (player) => player.status !== PlayerStatus.DISCONNECTED,
    );

    for (const player of activePlayers) {
      if (player.status === PlayerStatus.READY) {
        player.status = PlayerStatus.PLAYING;
      }
    }

    await this.repo.save(session);

    return this.findOne(sessionId, [
      'games',
      'games.gameLibrary',
      'players',
      'host',
    ]);
  }

  async completeSession(id: string): Promise<Session> {
    const session = await this.findOne(id, ['games']);

    if (session.status !== SessionStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Session cannot be completed. Current status: ${session.status}`,
      );
    }

    // Check if all games are completed or cancelled
    const incompleteGames = session.games?.filter(
      (game) =>
        ![GameStatus.COMPLETED, GameStatus.CANCELLED].includes(game.status),
    );

    if (incompleteGames?.length) {
      throw new BadRequestException(
        `Cannot complete session. ${incompleteGames.length} games are still in progress.`,
      );
    }

    session.status = SessionStatus.COMPLETED;
    return await this.repo.save(session);
  }

  async cancelSession(id: string): Promise<Session> {
    const session = await this.findOne(id, ['games']);

    if (
      [SessionStatus.COMPLETED, SessionStatus.CANCELLED].includes(
        session.status,
      )
    ) {
      throw new BadRequestException(
        `Session cannot be cancelled. Current status: ${session.status}`,
      );
    }

    // Cancel all in-progress games
    if (session.games?.length) {
      const activeGames = session.games.filter(
        (game) =>
          ![GameStatus.COMPLETED, GameStatus.CANCELLED].includes(game.status),
      );

      await Promise.all(
        activeGames.map((game) => {
          game.status = GameStatus.CANCELLED;
          return this.gameRepo.save(game);
        }),
      );
    }

    session.status = SessionStatus.CANCELLED;
    return await this.repo.save(session);
  }

  async update(id: string, dto: UpdateSessionDto): Promise<Session> {
    const session = await this.findOne(id);

    if (dto.gamesMasterId) {
      const host = await this.gamesMasterRepo.findOneBy({
        id: dto.gamesMasterId,
      });
      if (!host) {
        throw new NotFoundException(
          `GamesMaster with ID ${dto.gamesMasterId} not found`,
        );
      }
      session.host = host;
    }

    Object.assign(session, {
      name: dto.name ?? session.name,
      description: dto.description ?? session.description,
      date: dto.date ?? session.date,
      location: dto.location ?? session.location,
    });

    return await this.repo.save(session);
  }

  async remove(id: string): Promise<void> {
    const session = await this.findOne(id);
    await this.repo.remove(session);
  }

  async findByHost(hostId: string): Promise<Session[]> {
    return this.repo
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.host', 'host')
      .where('host.id = :hostId', { hostId })
      .orderBy('session.date', 'DESC')
      .getMany();
  }

  async findActiveSession(): Promise<Session | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.repo
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.host', 'host')
      .leftJoinAndSelect('session.players', 'players')
      .leftJoinAndSelect('session.teams', 'teams')
      .where('session.date = :today', { today })
      .orderBy('session.date', 'DESC')
      .getOne();
  }

  // Game management methods
  async addGamesToSession(
    sessionId: string,
    dto: AddGamesToSessionDto,
  ): Promise<Session> {
    const session = await this.findOne(sessionId, [
      'games',
      'games.gameLibrary',
    ]);

    // Verify all game library IDs exist
    const gameLibraries = await this.gameLibraryRepo.findByIds(
      dto.gameLibraryIds,
    );
    if (gameLibraries.length !== dto.gameLibraryIds.length) {
      throw new NotFoundException('One or more game library IDs not found');
    }

    // Create Game instances from GameLibrary templates
    const newGames = gameLibraries.map((gameLibrary) =>
      this.gameRepo.create({
        name: gameLibrary.name,
        session,
        gameLibrary,
        status: GameStatus.PENDING,
        currentRound: 0,
        maxRounds: 1, // Default, can be configured later
      }),
    );

    await this.gameRepo.save(newGames);
    return this.findOne(sessionId, ['games', 'games.gameLibrary']);
  }

  async removeGameFromSession(
    sessionId: string,
    dto: RemoveGameFromSessionDto,
  ): Promise<Session> {
    await this.findOne(sessionId, ['games']); // Validate session exists
    const game = await this.gameRepo.findOne({
      where: { id: dto.gameId, session: { id: sessionId } },
    });

    if (!game) {
      throw new NotFoundException(
        `Game with ID ${dto.gameId} not found in session ${sessionId}`,
      );
    }

    if (game.status === GameStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot remove a game that is in progress');
    }

    await this.gameRepo.remove(game);
    return this.findOne(sessionId, ['games', 'games.gameLibrary']);
  }

  async updateSessionGames(
    sessionId: string,
    gameLibraryIds: string[],
  ): Promise<Session> {
    const session = await this.findOne(sessionId, ['games']);

    // Remove existing games that aren't in progress
    const gamesToRemove = session.games.filter(
      (game) => game.status !== GameStatus.IN_PROGRESS,
    );
    if (gamesToRemove.length > 0) {
      await this.gameRepo.remove(gamesToRemove);
    }

    // Add new games
    if (gameLibraryIds.length > 0) {
      const dto: AddGamesToSessionDto = { gameLibraryIds };
      return this.addGamesToSession(sessionId, dto);
    }

    return this.findOne(sessionId, ['games', 'games.gameLibrary']);
  }

  async validatePlayerCountForGames(sessionId: string): Promise<{
    isValid: boolean;
    errors: string[];
    playerCount: number;
    gameRequirements: Array<{
      gameName: string;
      minPlayers: number;
      maxPlayers: number;
      isValidForCurrentPlayers: boolean;
    }>;
  }> {
    const session = await this.findOne(sessionId, [
      'games',
      'games.gameLibrary',
      'players',
    ]);

    const activePlayerCount = session.players.filter(
      (player) => player.status !== PlayerStatus.DISCONNECTED,
    ).length;

    const errors: string[] = [];
    const gameRequirements: Array<{
      gameName: string;
      minPlayers: number;
      maxPlayers: number;
      isValidForCurrentPlayers: boolean;
    }> = [];

    for (const game of session.games) {
      const { minPlayers, maxPlayers, name } = game.gameLibrary;
      const isValidForCurrentPlayers =
        activePlayerCount >= minPlayers && activePlayerCount <= maxPlayers;

      gameRequirements.push({
        gameName: name,
        minPlayers,
        maxPlayers,
        isValidForCurrentPlayers,
      });

      if (!isValidForCurrentPlayers) {
        errors.push(
          `${name} requires ${minPlayers}-${maxPlayers} players, but ${activePlayerCount} active players in session`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      playerCount: activePlayerCount,
      gameRequirements,
    };
  }

  async canStartSession(sessionId: string): Promise<{
    canStart: boolean;
    reasons: string[];
    checks: {
      hasGames: boolean;
      playersReady: boolean;
      playerCountValid: boolean;
      sessionScheduled: boolean;
    };
  }> {
    const session = await this.findOne(sessionId, [
      'games',
      'games.gameLibrary',
      'players',
    ]);

    const reasons: string[] = [];
    const checks = {
      hasGames: session.games.length > 0,
      playersReady: false,
      playerCountValid: false,
      sessionScheduled: session.status === SessionStatus.SCHEDULED,
    };

    // Check if session has games
    if (!checks.hasGames) {
      reasons.push('Session must have at least one game selected');
    }

    // Check if session is in correct status
    if (!checks.sessionScheduled) {
      reasons.push(
        `Session status must be SCHEDULED, current: ${session.status}`,
      );
    }

    // Check if all players are ready
    const activePlayers = session.players.filter(
      (player) => player.status !== PlayerStatus.DISCONNECTED,
    );
    checks.playersReady =
      activePlayers.length > 0 &&
      activePlayers.every((player) => player.status === PlayerStatus.READY);

    if (!checks.playersReady) {
      const readyCount = activePlayers.filter(
        (p) => p.status === PlayerStatus.READY,
      ).length;
      reasons.push(
        `All players must be ready. Currently ${readyCount}/${activePlayers.length} players ready`,
      );
    }

    // Check player count validity for all games
    if (checks.hasGames) {
      const validation = await this.validatePlayerCountForGames(sessionId);
      checks.playerCountValid = validation.isValid;

      if (!validation.isValid) {
        reasons.push(...validation.errors);
      }
    }

    return {
      canStart:
        checks.hasGames &&
        checks.playersReady &&
        checks.playerCountValid &&
        checks.sessionScheduled,
      reasons,
      checks,
    };
  }

  async getSessionReadiness(sessionId: string) {
    const session = await this.findOne(sessionId, [
      'players',
      'games',
      'games.gameLibrary',
    ]);

    const activePlayers = session.players.filter(
      (player) => player.status !== PlayerStatus.DISCONNECTED,
    );

    const playerStats = {
      total: session.players.length,
      active: activePlayers.length,
      ready: activePlayers.filter((p) => p.status === PlayerStatus.READY)
        .length,
      joined: activePlayers.filter((p) => p.status === PlayerStatus.JOINED)
        .length,
      playing: activePlayers.filter((p) => p.status === PlayerStatus.PLAYING)
        .length,
    };

    const gameValidation = await this.validatePlayerCountForGames(sessionId);
    const startCheck = await this.canStartSession(sessionId);

    return {
      session: {
        id: session.id,
        name: session.name,
        status: session.status,
        joinCode: session.joinCode,
      },
      players: playerStats,
      games: session.games.map((game) => ({
        id: game.id,
        name: game.gameLibrary.name,
        minPlayers: game.gameLibrary.minPlayers,
        maxPlayers: game.gameLibrary.maxPlayers,
        status: game.status,
      })),
      validation: gameValidation,
      readiness: startCheck,
    };
  }
}
