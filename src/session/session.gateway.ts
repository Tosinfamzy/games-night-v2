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
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class SessionGateway extends BaseGateway {
  @WebSocketServer()
  declare server: Server;

  protected logger = new Logger(SessionGateway.name);

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
}
