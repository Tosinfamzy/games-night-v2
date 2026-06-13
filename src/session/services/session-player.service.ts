import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../session.entity';
import { Player, PlayerStatus } from '../../player/player.entity';
import { Team } from '../../team/team.entity';
import { SessionStatus } from '../enums/session-status.enum';
import { SessionGateway } from '../session.gateway';
import { AuthService } from '../../auth/auth.service';
import { SessionReadinessService } from './session-readiness.service';
import { JoinSessionDto } from '../dto/join-session.dto';

export interface JoinSessionResult {
  session: Session;
  player: Player;
  message: string;
  playerToken: string;
}

@Injectable()
export class SessionPlayerService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @Inject(forwardRef(() => SessionGateway))
    private readonly sessionGateway: SessionGateway,
    private readonly authService: AuthService,
    private readonly readinessService: SessionReadinessService,
  ) {}

  /**
   * Join a session using a join code
   */
  async joinSession(
    dto: JoinSessionDto,
    userId?: string,
  ): Promise<JoinSessionResult> {
    const session = await this.findByJoinCode(dto.joinCode);

    if (session.status === SessionStatus.COMPLETED) {
      throw new BadRequestException('Cannot join a completed session');
    }

    if (session.status === SessionStatus.CANCELLED) {
      throw new BadRequestException('Cannot join a cancelled session');
    }

    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        `Cannot join session - current status: ${session.status}`,
      );
    }

    // Check if player name already exists in the session
    const existingPlayer = await this.playerRepo.findOne({
      where: { name: dto.playerName, session: { id: session.id } },
    });

    let savedPlayer: Player;

    if (existingPlayer) {
      // Player is rejoining - update their lastConnectedAt and return existing player
      existingPlayer.lastConnectedAt = new Date();
      existingPlayer.status = PlayerStatus.JOINED;
      savedPlayer = await this.playerRepo.save(existingPlayer);
    } else {
      // Create new player
      const player = this.playerRepo.create({
        name: dto.playerName,
        session,
        status: PlayerStatus.JOINED,
        lastConnectedAt: new Date(),
        userId: userId,
        isGuest: !userId,
      });

      savedPlayer = await this.playerRepo.save(player);
    }

    // Broadcast player joined event via WebSocket
    this.sessionGateway.broadcastPlayerJoined(session.id, savedPlayer);

    // Reload session with updated players
    const updatedSession = await this.findByJoinCode(dto.joinCode);

    return {
      session: updatedSession,
      player: savedPlayer,
      message: `Successfully joined session hosted by ${session.host.name}`,
      playerToken: this.authService.generatePlayerToken(
        savedPlayer.id,
        updatedSession.id,
        savedPlayer.name,
      ),
    };
  }

  /**
   * Rejoin a session using a valid player token
   */
  async rejoinSession(playerToken: string): Promise<JoinSessionResult> {
    const tokenData = this.authService.validatePlayerToken(playerToken);

    if (!tokenData) {
      throw new BadRequestException('Invalid or expired player token');
    }

    const player = await this.playerRepo.findOne({
      where: { id: tokenData.playerId },
      relations: ['session'],
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    if (player.session.id !== tokenData.sessionId) {
      throw new BadRequestException('Token session mismatch');
    }

    player.lastConnectedAt = new Date();
    player.status = PlayerStatus.JOINED;
    await this.playerRepo.save(player);

    const session = await this.findOne(player.session.id, [
      'host',
      'games',
      'teams',
      'players',
    ]);

    return {
      session,
      player,
      message: `Welcome back, ${player.name}!`,
      playerToken: this.authService.generatePlayerToken(
        player.id,
        session.id,
        player.name,
      ),
    };
  }

  /**
   * Set player ready status
   */
  async setPlayerReady(
    sessionId: string,
    playerId: string,
    ready: boolean = true,
  ): Promise<Player> {
    const player = await this.playerRepo.findOne({
      where: { id: playerId, session: { id: sessionId } },
      relations: ['session'],
    });

    if (!player) {
      throw new NotFoundException(
        `Player with ID ${playerId} not found in session ${sessionId}`,
      );
    }

    if (player.session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        `Cannot change player status when session is ${player.session.status}`,
      );
    }

    player.status = ready ? PlayerStatus.READY : PlayerStatus.JOINED;
    player.lastConnectedAt = new Date();

    const savedPlayer = await this.playerRepo.save(player);

    // Broadcast player readiness change
    this.sessionGateway.broadcastPlayerReadiness(sessionId, playerId, ready);

    // Also broadcast session readiness update
    const readiness = await this.readinessService.canStartSession(sessionId);
    this.sessionGateway.broadcastSessionReadiness(sessionId, {
      canStart: readiness.canStart,
      reasons: readiness.reasons,
    });

    return savedPlayer;
  }

  /**
   * Update player status
   */
  async updatePlayerStatus(
    sessionId: string,
    playerId: string,
    status: PlayerStatus,
  ): Promise<Player> {
    const player = await this.playerRepo.findOne({
      where: { id: playerId, session: { id: sessionId } },
      relations: ['session'],
    });

    if (!player) {
      throw new NotFoundException(
        `Player with ID ${playerId} not found in session ${sessionId}`,
      );
    }

    player.status = status;
    if (status !== PlayerStatus.DISCONNECTED) {
      player.lastConnectedAt = new Date();
    }

    return await this.playerRepo.save(player);
  }

  /**
   * Get all players in a session
   */
  async getSessionPlayers(sessionId: string): Promise<Player[]> {
    const session = await this.findOne(sessionId, ['players']);
    return session.players;
  }

  /**
   * Remove a player from a session
   */
  async removePlayerFromSession(
    sessionId: string,
    playerId: string,
  ): Promise<void> {
    const player = await this.playerRepo.findOne({
      where: { id: playerId, session: { id: sessionId } },
      relations: ['session'],
    });

    if (!player) {
      throw new NotFoundException(
        `Player with ID ${playerId} not found in session ${sessionId}`,
      );
    }

    if (player.session.status === SessionStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Cannot remove players from a session in progress',
      );
    }

    await this.playerRepo.remove(player);
  }

  /**
   * Kick a player from a session (GM action)
   */
  async kickPlayer(sessionId: string, playerId: string): Promise<Session> {
    const session = await this.findOne(sessionId, ['players']);

    if (session.status === SessionStatus.COMPLETED) {
      throw new BadRequestException(
        'Cannot kick players from completed session',
      );
    }

    const player = await this.playerRepo.findOne({
      where: { id: playerId },
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${playerId} not found`);
    }

    const playerInSession = session.players?.some((p) => p.id === playerId);
    if (!playerInSession) {
      throw new BadRequestException('Player is not in this session');
    }

    // Remove player from session
    session.players = session.players.filter((p) => p.id !== playerId);

    // Remove player from all teams in this session
    const teams = await this.teamRepo.find({
      where: { session: { id: sessionId } },
      relations: ['players'],
    });

    for (const team of teams) {
      if (team.players) {
        team.players = team.players.filter((p) => p.id !== playerId);
        await this.teamRepo.save(team);
      }
    }

    await this.sessionRepo.save(session);

    // Delete the player entity
    await this.playerRepo.remove(player);

    return session;
  }

  /**
   * Helper: Find a session by join code
   */
  private async findByJoinCode(joinCode: string): Promise<Session> {
    const session = await this.sessionRepo.findOne({
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

  /**
   * Helper: Find a session by ID
   */
  private async findOne(
    id: string,
    relations: string[] = [],
  ): Promise<Session> {
    const session = await this.sessionRepo.findOne({
      where: { id },
      relations,
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    return session;
  }
}
