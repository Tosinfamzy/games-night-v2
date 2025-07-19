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

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private readonly repo: Repository<Session>,
    @InjectRepository(GamesMaster)
    private readonly gamesMasterRepo: Repository<GamesMaster>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
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

  async startSession(id: string): Promise<Session> {
    const session = await this.findOne(id, ['games']);

    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        `Session cannot be started. Current status: ${session.status}`,
      );
    }

    if (!session.games?.length) {
      throw new BadRequestException(
        'Cannot start session without any scheduled games',
      );
    }

    session.status = SessionStatus.IN_PROGRESS;
    return await this.repo.save(session);
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
}
