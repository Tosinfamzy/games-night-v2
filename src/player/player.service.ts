import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player, PlayerStatus } from './player.entity';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { JoinSessionDto } from './dto/join-session.dto';
import { UpdatePlayerStatusDto } from './dto/update-player-status.dto';
import { Session } from '../session/session.entity';
import { SessionStatus } from '../session/enums/session-status.enum';
import { SessionGateway } from '../session/session.gateway';

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(Player)
    private readonly repo: Repository<Player>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    @Inject(forwardRef(() => SessionGateway))
    private readonly sessionGateway: SessionGateway,
  ) {}

  async create(dto: CreatePlayerDto): Promise<Player> {
    const session = await this.sessionRepo.findOneBy({ id: dto.sessionId });
    if (!session) {
      throw new NotFoundException(`Session with ID ${dto.sessionId} not found`);
    }

    // Check if player name is unique within the session
    await this.validatePlayerNameInSession(dto.name, session.id);

    const player = this.repo.create({
      name: dto.name,
      session,
      status: PlayerStatus.JOINED,
      lastConnectedAt: new Date(),
    });
    return await this.repo.save(player);
  }

  async joinSession(dto: JoinSessionDto): Promise<Player> {
    // Find session by join code
    const session = await this.sessionRepo.findOne({
      where: { joinCode: dto.joinCode },
      relations: ['players'],
    });

    if (!session) {
      throw new NotFoundException(
        `Session with join code ${dto.joinCode} not found`,
      );
    }

    // Check if session is joinable
    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        `Cannot join session - current status: ${session.status}`,
      );
    }

    // Check if player name is unique within the session
    await this.validatePlayerNameInSession(dto.name, session.id);

    const player = this.repo.create({
      name: dto.name,
      session,
      status: PlayerStatus.JOINED,
      lastConnectedAt: new Date(),
    });

    const savedPlayer = await this.repo.save(player);

    // Broadcast player joined event via WebSocket
    this.sessionGateway.broadcastPlayerJoined(session.id, savedPlayer);

    return savedPlayer;
  }

  async updatePlayerStatus(
    id: string,
    dto: UpdatePlayerStatusDto,
  ): Promise<Player> {
    const player = await this.findOne(id);

    player.status = dto.status;
    if (dto.lastConnectedAt) {
      player.lastConnectedAt = dto.lastConnectedAt;
    } else if (dto.status !== PlayerStatus.DISCONNECTED) {
      player.lastConnectedAt = new Date();
    }

    return await this.repo.save(player);
  }

  async setPlayerReady(id: string): Promise<Player> {
    return this.updatePlayerStatus(id, { status: PlayerStatus.READY });
  }

  async setPlayerNotReady(id: string): Promise<Player> {
    return this.updatePlayerStatus(id, { status: PlayerStatus.JOINED });
  }

  async markPlayerDisconnected(id: string): Promise<Player> {
    return this.updatePlayerStatus(id, { status: PlayerStatus.DISCONNECTED });
  }

  async removeFromSession(id: string): Promise<void> {
    const player = await this.findOne(id, ['session']);

    // Check if session has started
    if (player.session.status === SessionStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Cannot remove player from session that is in progress',
      );
    }

    await this.repo.remove(player);
  }

  private async validatePlayerNameInSession(
    name: string,
    sessionId: string,
    excludePlayerId?: string,
  ): Promise<void> {
    const existingPlayer = await this.repo.findOne({
      where: {
        name: name.trim(),
        session: { id: sessionId },
      },
    });

    if (existingPlayer && existingPlayer.id !== excludePlayerId) {
      throw new ConflictException(
        `Player name "${name}" is already taken in this session`,
      );
    }
  }

  async findAll(relations: string[] = []): Promise<Player[]> {
    const defaultRelations = ['session', 'teams', 'scores'];
    const mergedRelations = Array.from(
      new Set([...defaultRelations, ...relations]),
    );
    return this.repo.find({
      relations: mergedRelations,
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

    // If updating name, validate uniqueness in session
    if (dto.name && dto.name !== player.name) {
      await this.validatePlayerNameInSession(dto.name, player.session.id, id);
    }

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
      relations: ['session', 'teams', 'scores'],
      order: { name: 'ASC' },
    });
  }

  async getSessionPlayerStats(sessionId: string) {
    const players = await this.findBySession(sessionId);

    const stats = {
      total: players.length,
      joined: players.filter((p) => p.status === PlayerStatus.JOINED).length,
      ready: players.filter((p) => p.status === PlayerStatus.READY).length,
      playing: players.filter((p) => p.status === PlayerStatus.PLAYING).length,
      disconnected: players.filter(
        (p) => p.status === PlayerStatus.DISCONNECTED,
      ).length,
    };

    return {
      players,
      stats,
    };
  }

  async areAllPlayersReady(sessionId: string): Promise<boolean> {
    const players = await this.findBySession(sessionId);
    const activePlayers = players.filter(
      (p) => p.status !== PlayerStatus.DISCONNECTED,
    );

    return (
      activePlayers.length > 0 &&
      activePlayers.every((p) => p.status === PlayerStatus.READY)
    );
  }

  async setAllPlayersToPlaying(sessionId: string): Promise<void> {
    const players = await this.findBySession(sessionId);
    const readyPlayers = players.filter((p) => p.status === PlayerStatus.READY);

    for (const player of readyPlayers) {
      player.status = PlayerStatus.PLAYING;
      await this.repo.save(player);
    }
  }

  /**
   * Find player by userId (for authenticated players)
   */
  async findByUserId(userId: string): Promise<Player | null> {
    return this.repo.findOne({
      where: { userId },
      relations: ['session'],
    });
  }

  /**
   * Mark player as online with current socket ID
   */
  async setPlayerOnline(
    playerId: string,
    socketId: string,
  ): Promise<Player> {
    const player = await this.findOne(playerId);

    player.isOnline = true;
    player.currentSocketId = socketId;
    player.lastConnectedAt = new Date();

    // Update status if player was disconnected
    if (player.status === PlayerStatus.DISCONNECTED) {
      player.status = PlayerStatus.JOINED;
    }

    return await this.repo.save(player);
  }

  /**
   * Mark player as offline
   */
  async setPlayerOffline(playerId: string): Promise<Player> {
    const player = await this.findOne(playerId);

    player.isOnline = false;
    player.currentSocketId = undefined;
    player.status = PlayerStatus.DISCONNECTED;

    return await this.repo.save(player);
  }

  /**
   * Get all online players in a session
   */
  async getAllOnlinePlayers(sessionId: string): Promise<Player[]> {
    return this.repo.find({
      where: {
        session: { id: sessionId },
        isOnline: true,
      },
      relations: ['session', 'teams'],
      order: { name: 'ASC' },
    });
  }

  /**
   * Find player by socket ID (for connection tracking)
   */
  async findBySocketId(socketId: string): Promise<Player | null> {
    return this.repo.findOne({
      where: { currentSocketId: socketId },
      relations: ['session'],
    });
  }
}
