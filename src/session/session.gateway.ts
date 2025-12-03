import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { BaseGateway } from '../common/gateways/base.gateway';
import { Player } from '../player/player.entity';
import { Team } from '../team/team.entity';
import { Session } from './session.entity';
import { PlayerService } from '../player/player.service';

interface SessionReadiness {
  canStart: boolean;
  reasons: string[];
}

/**
 * WebSocket Gateway for real-time session updates
 * Handles player joins, readiness updates, team formation, etc.
 */
@WebSocketGateway({
  namespace: 'sessions',
  cors: {
    origin: [
      'http://localhost:5173',
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
      /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
    ],
    credentials: true,
  },
})
export class SessionGateway extends BaseGateway {
  @WebSocketServer()
  declare server: Server;

  protected logger = new Logger(SessionGateway.name);

  constructor(private readonly playerService: PlayerService) {
    super();
  }

  /**
   * Handle client connection and update player online status
   */
  async handleConnection(client: Socket): Promise<void> {
    super.handleConnection(client);

    try {
      // Extract playerId from handshake query or auth
      const playerId = client.handshake.query.playerId as string;

      if (!playerId) {
        this.logger.warn(`Connection without playerId: ${client.id}`);
        return;
      }

      // Mark player as online
      const player = await this.playerService.setPlayerOnline(
        playerId,
        client.id,
      );

      this.logger.log(
        `Player ${player.name} connected to session ${player.session.id}`,
      );

      // Broadcast player online status to session room
      this.broadcastPlayerOnline(player.session.id, player.id, player.name);

      // Auto-join the player to their session room
      const room = `session:${player.session.id}`;
      this.joinRoom(client, room);
    } catch (error) {
      this.logger.error(
        `Failed to handle player connection: ${error.message}`,
      );
    }
  }

  /**
   * Handle client disconnection and update player offline status
   */
  async handleDisconnect(client: Socket): Promise<void> {
    try {
      // Find player by socket ID
      const player = await this.playerService.findBySocketId(client.id);

      if (!player) {
        this.logger.warn(`Disconnect from unknown socket: ${client.id}`);
        super.handleDisconnect(client);
        return;
      }

      // Mark player as offline
      await this.playerService.setPlayerOffline(player.id);

      this.logger.log(
        `Player ${player.name} disconnected from session ${player.session.id}`,
      );

      // Broadcast player offline status to session room
      this.broadcastPlayerOffline(player.session.id, player.id, player.name);
    } catch (error) {
      this.logger.error(
        `Failed to handle player disconnection: ${error.message}`,
      );
    }

    super.handleDisconnect(client);
  }

  /**
   * Client joins a session room to receive updates
   */
  @SubscribeMessage('join-session')
  handleJoinSession(
    @MessageBody() sessionId: string,
    @ConnectedSocket() client: Socket,
  ): { status: string; sessionId: string } {
    const room = `session:${sessionId}`;
    this.joinRoom(client, room);

    this.logger.log(`Client ${client.id} joined session: ${sessionId}`);

    return {
      status: 'joined',
      sessionId,
    };
  }

  /**
   * Client leaves a session room
   */
  @SubscribeMessage('leave-session')
  handleLeaveSession(
    @MessageBody() sessionId: string,
    @ConnectedSocket() client: Socket,
  ): { status: string; sessionId: string } {
    const room = `session:${sessionId}`;
    this.leaveRoom(client, room);

    this.logger.log(`Client ${client.id} left session: ${sessionId}`);

    return {
      status: 'left',
      sessionId,
    };
  }

  /**
   * Broadcast that a player joined a session
   */
  broadcastPlayerJoined(sessionId: string, player: Player): void {
    const room = `session:${sessionId}`;
    this.emitToRoom(room, 'session:player-joined', {
      sessionId,
      player,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast that a player left a session
   */
  broadcastPlayerLeft(sessionId: string, playerId: string): void {
    const room = `session:${sessionId}`;
    this.emitToRoom(room, 'session:player-left', {
      sessionId,
      playerId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast player readiness change
   */
  broadcastPlayerReadiness(
    sessionId: string,
    playerId: string,
    ready: boolean,
  ): void {
    const room = `session:${sessionId}`;
    this.emitToRoom(room, 'session:player-ready-changed', {
      sessionId,
      playerId,
      ready,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast session readiness status
   */
  broadcastSessionReadiness(
    sessionId: string,
    readiness: SessionReadiness,
  ): void {
    const room = `session:${sessionId}`;
    this.emitToRoom(room, 'session:readiness-changed', {
      sessionId,
      readiness,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast session status change (started, completed, cancelled)
   */
  broadcastSessionStatusChange(
    sessionId: string,
    status: string,
    session?: Session,
  ): void {
    const room = `session:${sessionId}`;
    this.emitToRoom(room, 'session:status-changed', {
      sessionId,
      status,
      session,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast team created
   */
  broadcastTeamCreated(sessionId: string, team: Team): void {
    const room = `session:${sessionId}`;
    this.emitToRoom(room, 'session:team-created', {
      sessionId,
      team,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast team updated
   */
  broadcastTeamUpdated(sessionId: string, team: Team): void {
    const room = `session:${sessionId}`;
    this.emitToRoom(room, 'session:team-updated', {
      sessionId,
      team,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast team deleted
   */
  broadcastTeamDeleted(sessionId: string, teamId: string): void {
    const room = `session:${sessionId}`;
    this.emitToRoom(room, 'session:team-deleted', {
      sessionId,
      teamId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast player assigned to team
   */
  broadcastPlayerAssignedToTeam(
    sessionId: string,
    teamId: string,
    playerId: string,
  ): void {
    const room = `session:${sessionId}`;
    this.emitToRoom(room, 'session:player-assigned-to-team', {
      sessionId,
      teamId,
      playerId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast session can-start status change
   */
  broadcastCanStartChanged(sessionId: string, canStart: boolean): void {
    const room = `session:${sessionId}`;
    this.emitToRoom(room, 'session:can-start-changed', {
      sessionId,
      canStart,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast player came online
   */
  broadcastPlayerOnline(
    sessionId: string,
    playerId: string,
    playerName: string,
  ): void {
    const room = `session:${sessionId}`;
    this.emitToRoom(room, 'session:player-online', {
      sessionId,
      playerId,
      playerName,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast player went offline
   */
  broadcastPlayerOffline(
    sessionId: string,
    playerId: string,
    playerName: string,
  ): void {
    const room = `session:${sessionId}`;
    this.emitToRoom(room, 'session:player-offline', {
      sessionId,
      playerId,
      playerName,
      timestamp: new Date().toISOString(),
    });
  }
}
