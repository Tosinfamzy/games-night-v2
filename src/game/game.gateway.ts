import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BaseGateway } from '../common/gateways/base.gateway';

/**
 * WebSocket Gateway for real-time game updates
 * Handles live scoring, game flow, round progression, etc.
 */
@WebSocketGateway({
  namespace: 'games',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class GameGateway extends BaseGateway {
  @WebSocketServer()
  server: Server;

  protected logger = new Logger(GameGateway.name);

  /**
   * Client joins a game room to receive updates
   */
  @SubscribeMessage('join-game')
  handleJoinGame(
    @MessageBody() gameId: string,
    @ConnectedSocket() client: Socket,
  ): { status: string; gameId: string } {
    const room = `game:${gameId}`;
    this.joinRoom(client, room);

    this.logger.log(`Client ${client.id} joined game: ${gameId}`);

    return {
      status: 'joined',
      gameId,
    };
  }

  /**
   * Client leaves a game room
   */
  @SubscribeMessage('leave-game')
  handleLeaveGame(
    @MessageBody() gameId: string,
    @ConnectedSocket() client: Socket,
  ): { status: string; gameId: string } {
    const room = `game:${gameId}`;
    this.leaveRoom(client, room);

    this.logger.log(`Client ${client.id} left game: ${gameId}`);

    return {
      status: 'left',
      gameId,
    };
  }

  /**
   * Listen to score.submitted event from EventEmitter and broadcast
   */
  @OnEvent('score.submitted')
  handleScoreSubmitted(payload: {
    gameId: string;
    teamId: string;
    score: any;
  }): void {
    const room = `game:${payload.gameId}`;

    this.logger.log(
      `Broadcasting score submitted for game: ${payload.gameId}`,
    );

    this.emitToRoom(room, 'game:score-submitted', {
      gameId: payload.gameId,
      teamId: payload.teamId,
      score: payload.score,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast game started
   */
  broadcastGameStarted(gameId: string, game: any): void {
    const room = `game:${gameId}`;
    this.emitToRoom(room, 'game:started', {
      gameId,
      game,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast game paused
   */
  broadcastGamePaused(gameId: string): void {
    const room = `game:${gameId}`;
    this.emitToRoom(room, 'game:paused', {
      gameId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast game resumed
   */
  broadcastGameResumed(gameId: string): void {
    const room = `game:${gameId}`;
    this.emitToRoom(room, 'game:resumed', {
      gameId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast game completed
   */
  broadcastGameCompleted(gameId: string, game: any): void {
    const room = `game:${gameId}`;
    this.emitToRoom(room, 'game:completed', {
      gameId,
      game,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast round started
   */
  broadcastRoundStarted(gameId: string, roundNumber: number): void {
    const room = `game:${gameId}`;
    this.emitToRoom(room, 'game:round-started', {
      gameId,
      roundNumber,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast round ended
   */
  broadcastRoundEnded(gameId: string, roundNumber: number): void {
    const room = `game:${gameId}`;
    this.emitToRoom(room, 'game:round-ended', {
      gameId,
      roundNumber,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast game state changed
   */
  broadcastGameStateChanged(gameId: string, state: any): void {
    const room = `game:${gameId}`;
    this.emitToRoom(room, 'game:state-changed', {
      gameId,
      state,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast leaderboard update
   */
  broadcastLeaderboardUpdate(gameId: string, leaderboard: any[]): void {
    const room = `game:${gameId}`;
    this.emitToRoom(room, 'game:leaderboard-updated', {
      gameId,
      leaderboard,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast score updated
   */
  broadcastScoreUpdated(gameId: string, score: any): void {
    const room = `game:${gameId}`;
    this.emitToRoom(room, 'game:score-updated', {
      gameId,
      score,
      timestamp: new Date().toISOString(),
    });
  }
}
