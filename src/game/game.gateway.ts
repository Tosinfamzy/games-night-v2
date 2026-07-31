import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkipThrottle } from '@nestjs/throttler';
import { OnEvent } from '@nestjs/event-emitter';
import { BaseGateway } from '../common/gateways/base.gateway';
import { WS_CORS_CONFIG } from '../common/config/cors.config';
import { Game } from './game.entity';
import { WsPlayerAuthGuard } from '../auth/guards/ws-player-auth.guard';
import { AppSocket } from '../common/types/socket.types';

/**
 * WebSocket Gateway for real-time game updates
 * Handles live scoring, game flow, round progression, etc.
 * Protected by WsPlayerAuthGuard - all connections require valid player token
 */
@WebSocketGateway({
  namespace: 'games',
  cors: WS_CORS_CONFIG,
})
@UseGuards(WsPlayerAuthGuard)
@SkipThrottle() // HTTP ThrottlerGuard can't read a WS context; skip it here
export class GameGateway extends BaseGateway {
  @WebSocketServer()
  declare server: Server;

  protected logger = new Logger(GameGateway.name);

  constructor(
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
  ) {
    super();
  }

  /**
   * Client joins a game room to receive updates. The game must belong to the
   * caller's session — otherwise any player could subscribe to another
   * session's live scores/turns/timer.
   */
  @SubscribeMessage('join-game')
  async handleJoinGame(
    @MessageBody() gameId: string,
    @ConnectedSocket() client: AppSocket,
  ): Promise<{ status: string; gameId: string; error?: string }> {
    const player = client.data.player;
    if (!player) {
      return { status: 'error', gameId, error: 'Unauthorized' };
    }

    // Game.session is eager.
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game || game.session?.id !== player.sessionId) {
      this.logger.warn(
        `Player ${player.playerId} tried to join game ${gameId} outside their session`,
      );
      return {
        status: 'error',
        gameId,
        error: 'Cannot join a game outside your session',
      };
    }

    this.joinRoom(client, `game:${gameId}`);
    this.logger.log(`Client ${client.id} joined game: ${gameId}`);

    return { status: 'joined', gameId };
  }

  /**
   * Client leaves a game room
   */
  @SubscribeMessage('leave-game')
  handleLeaveGame(
    @MessageBody() gameId: string,
    @ConnectedSocket() client: AppSocket,
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
    entrantType?: 'team' | 'player';
    entrantId?: string;
    teamId?: string;
    playerId?: string;
    points: number;
    roundNumber: number;
  }): void {
    const room = `game:${payload.gameId}`;

    this.logger.log(`Broadcasting score submitted for game: ${payload.gameId}`);

    // Forward the fields the service actually emits — the old handler
    // destructured a `score` object that was never sent, so every broadcast
    // carried `score: undefined` and dropped the round number. teamId/playerId
    // let the client update the right entrant in either scoring mode.
    this.emitToRoom(room, 'game:score-submitted', {
      gameId: payload.gameId,
      entrantType: payload.entrantType,
      entrantId: payload.entrantId,
      teamId: payload.teamId,
      playerId: payload.playerId,
      points: payload.points,
      roundNumber: payload.roundNumber,
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
    turnStartedAt?: Date,
  ): void {
    const room = `game:${gameId}`;
    const startedAt = turnStartedAt ?? new Date();
    const turnEndsAt = turnTimeLimit
      ? new Date(startedAt.getTime() + turnTimeLimit * 1000).toISOString()
      : undefined;
    this.emitToRoom(room, 'game:turn-started', {
      gameId,
      teamId,
      teamName,
      turnTimeLimit,
      // Fields the frontend timer reads to seed the countdown.
      turnStartedAt: startedAt.toISOString(),
      turnEndsAt,
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
      // The frontend reads `timeRemaining`; without this the countdown never
      // advanced (it was reading undefined every tick).
      timeRemaining: remainingSeconds,
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
    turnTimeLimit?: number,
    turnStartedAt?: Date,
  ): void {
    const room = `game:${gameId}`;
    const startedAt = turnStartedAt ?? new Date();
    const turnEndsAt = turnTimeLimit
      ? new Date(startedAt.getTime() + turnTimeLimit * 1000).toISOString()
      : undefined;
    this.emitToRoom(room, 'game:turn-advanced', {
      gameId,
      previousTeamId,
      // Legacy names + the names the frontend timer actually reads.
      newTeamId,
      newTeamName,
      wasAutomatic,
      nextTeamId: newTeamId,
      nextTeamName: newTeamName,
      autoAdvanced: wasAutomatic,
      turnTimeLimit,
      turnEndsAt,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast that a game was cancelled — the FE listens for this to leave the
   * game live view; without it players/TV stayed on a cancelled game until a poll.
   */
  broadcastGameCancelled(gameId: string): void {
    const room = `game:${gameId}`;
    this.emitToRoom(room, 'game:cancelled', {
      gameId,
      timestamp: new Date().toISOString(),
    });
  }
}
