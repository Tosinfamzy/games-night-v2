import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { OnEvent } from '@nestjs/event-emitter';
import { BaseGateway } from '../common/gateways/base.gateway';
import { WS_CORS_CONFIG } from '../common/config/cors.config';
import { TIME } from '../common/constants';
import { Player } from '../player/player.entity';
import { Team } from '../team/team.entity';
import { Session } from './session.entity';
import { PlayerService } from '../player/player.service';
import { WsPlayerAuthGuard } from '../auth/guards/ws-player-auth.guard';
import { AppSocket } from '../common/types/socket.types';
import { getErrorMessage } from '../common/utils/error.util';

interface SessionReadiness {
  canStart: boolean;
  reasons: string[];
}

/**
 * WebSocket Gateway for real-time session updates
 * Handles player joins, readiness updates, team formation, etc.
 * Protected by WsPlayerAuthGuard - all connections require valid player token
 */
@WebSocketGateway({
  namespace: 'sessions',
  cors: WS_CORS_CONFIG,
})
@UseGuards(WsPlayerAuthGuard)
@SkipThrottle() // HTTP ThrottlerGuard can't read a WS context; skip it here
export class SessionGateway extends BaseGateway {
  @WebSocketServer()
  declare server: Server;

  protected logger = new Logger(SessionGateway.name);

  // Pending "player offline" broadcasts, keyed by playerId. A disconnect
  // schedules one after a grace period; a reconnect within the window cancels
  // it, so a brief phone-lock/network-handoff doesn't flicker the player
  // offline in everyone's roster.
  private readonly pendingOffline = new Map<string, NodeJS.Timeout>();

  constructor(private readonly playerService: PlayerService) {
    super();
  }

  /**
   * Handle client connection and update player online status
   * Player is already authenticated by WsPlayerAuthGuard
   */
  async handleConnection(client: AppSocket): Promise<void> {
    void super.handleConnection(client);

    try {
      // Extract authenticated player data from socket (set by WsPlayerAuthGuard)
      const playerData = client.data.player;

      if (!playerData) {
        this.logger.error(
          `Connection without authenticated player data: ${client.id}`,
        );
        client.disconnect();
        return;
      }

      const { playerId, sessionId, playerName } = playerData;

      // Mark player as online
      await this.playerService.setPlayerOnline(playerId, client.id);

      // Cancel any pending offline broadcast — the player is back within the
      // grace window, so no one ever needs to see them drop.
      const pending = this.pendingOffline.get(playerId);
      if (pending) {
        clearTimeout(pending);
        this.pendingOffline.delete(playerId);
      }

      this.logger.log(
        `Player ${playerName} (${playerId}) connected to session ${sessionId}`,
      );

      // Broadcast player online status to session room
      this.broadcastPlayerOnline(sessionId, playerId, playerName);

      // Auto-join the player to their session room
      const room = `session:${sessionId}`;
      this.joinRoom(client, room);
    } catch (error) {
      this.logger.error(
        `Failed to handle player connection: ${getErrorMessage(error)}`,
      );
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection and update player offline status
   */
  async handleDisconnect(client: AppSocket): Promise<void> {
    try {
      // Find player by socket ID
      const player = await this.playerService.findBySocketId(client.id);

      if (!player) {
        this.logger.warn(`Disconnect from unknown socket: ${client.id}`);
        void super.handleDisconnect(client);
        return;
      }

      // Defer marking the player offline. Phones lock/background constantly at
      // a party, dropping the socket for a few seconds; broadcasting offline
      // immediately would flicker the roster on every lock. If the player
      // reconnects within the grace window, handleConnection cancels this and
      // no one sees them drop. Only a genuine, sustained disconnect goes offline.
      const { id: playerId, name: playerName } = player;
      const sessionId = player.session.id;
      this.logger.log(
        `Player ${playerName} disconnected from session ${sessionId} ` +
          `(offline in ${TIME.PLAYER_OFFLINE_GRACE_MS / 1000}s unless back)`,
      );

      const existing = this.pendingOffline.get(playerId);
      if (existing) {
        clearTimeout(existing);
      }
      const timer = setTimeout(() => {
        this.pendingOffline.delete(playerId);
        void this.playerService
          .setPlayerOffline(playerId)
          .then(() => {
            this.broadcastPlayerOffline(sessionId, playerId, playerName);
          })
          .catch((error) => {
            this.logger.error(
              `Failed to mark player offline: ${getErrorMessage(error)}`,
            );
          });
      }, TIME.PLAYER_OFFLINE_GRACE_MS);
      this.pendingOffline.set(playerId, timer);
    } catch (error) {
      this.logger.error(
        `Failed to handle player disconnection: ${getErrorMessage(error)}`,
      );
    }

    void super.handleDisconnect(client);
  }

  /**
   * Client joins a session room to receive updates
   * Validates that player belongs to the session
   */
  @SubscribeMessage('join-session')
  handleJoinSession(
    @MessageBody() sessionId: string,
    @ConnectedSocket() client: AppSocket,
  ): { status: string; sessionId: string; error?: string } {
    // Validate player belongs to this session
    const playerData = client.data.player;

    if (!playerData) {
      this.logger.warn(`Unauthenticated join-session attempt: ${client.id}`);
      return {
        status: 'error',
        sessionId,
        error: 'Unauthorized',
      };
    }

    if (playerData.sessionId !== sessionId) {
      this.logger.warn(
        `Player ${playerData.playerId} attempted to join session ${sessionId} but belongs to ${playerData.sessionId}`,
      );
      return {
        status: 'error',
        sessionId,
        error: 'Cannot join session you do not belong to',
      };
    }

    const room = `session:${sessionId}`;
    this.joinRoom(client, room);

    this.logger.log(
      `Player ${playerData.playerName} joined session room: ${sessionId}`,
    );

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
    @ConnectedSocket() client: AppSocket,
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
   * Bridge InviteService's `invite.updated` events to the session room so the
   * host's guest list updates live. The invite module stays decoupled — it just
   * emits the event; this gateway owns the WebSocket broadcast.
   */
  @OnEvent('invite.updated')
  handleInviteUpdated(payload: { sessionId: string }): void {
    const room = `session:${payload.sessionId}`;
    this.emitToRoom(room, 'session:invites-updated', {
      sessionId: payload.sessionId,
      timestamp: new Date().toISOString(),
    });
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
