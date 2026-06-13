import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BaseGateway } from '../common/gateways/base.gateway';
import { Game } from './game.entity';
import { Score } from '../score/score.entity';
import { WsPlayerAuthGuard } from '../auth/guards/ws-player-auth.guard';

/**
 * WebSocket Gateway for real-time game updates
 * Handles live scoring, game flow, round progression, etc.
 * Protected by WsPlayerAuthGuard - all connections require valid player token
 */
@WebSocketGateway({
  namespace: 'games',
  cors: {
    origin: [
      'http://localhost:5173',
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
      /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
    ],
    credentials: true,
  },
})
@UseGuards(WsPlayerAuthGuard)
export class GameGateway extends BaseGateway {
  @WebSocketServer()
  declare server: Server;

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
    score: Score;
  }): void {
    const room = `game:${payload.gameId}`;

    this.logger.log(`Broadcasting score submitted for game: ${payload.gameId}`);

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
  broadcastGameStarted(gameId: string, game: Game): void {
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
  broadcastGameCompleted(gameId: string, game: Game): void {
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
   * Broadcast turn started with timer info
   */
  broadcastTurnStarted(
    gameId: string,
    teamId: string,
    teamName: string,
    turnTimeLimit?: number,
  ): void {
    const room = `game:${gameId}`;
    this.emitToRoom(room, 'game:turn-started', {
      gameId,
      teamId,
      teamName,
      turnTimeLimit,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast timer tick (every second during countdown)
   */
  broadcastTimerTick(
    gameId: string,
    remainingSeconds: number,
    isWarning: boolean,
  ): void {
    const room = `game:${gameId}`;
    this.emitToRoom(room, 'game:timer-tick', {
      gameId,
      remainingSeconds,
      isWarning,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast timer expired
   */
  broadcastTimerExpired(
    gameId: string,
    teamId: string,
    teamName: string,
    willAutoAdvance: boolean,
  ): void {
    const room = `game:${gameId}`;
    this.emitToRoom(room, 'game:timer-expired', {
      gameId,
      teamId,
      teamName,
      willAutoAdvance,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast turn advanced (manual or auto)
   */
  broadcastTurnAdvanced(
    gameId: string,
    previousTeamId: string,
    newTeamId: string,
    newTeamName: string,
    wasAutomatic: boolean,
  ): void {
    const room = `game:${gameId}`;
    this.emitToRoom(room, 'game:turn-advanced', {
      gameId,
      previousTeamId,
      newTeamId,
      newTeamName,
      wasAutomatic,
      timestamp: new Date().toISOString(),
    });
  }
}
