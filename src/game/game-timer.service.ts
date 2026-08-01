import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { TIME } from '../common/constants';
import { getErrorMessage } from '../common/utils/error.util';

interface ActiveTimer {
  gameId: string;
  // The entrant whose turn is timed — a team (team mode) or a player
  // (individual mode). Named generically since the timer is mode-agnostic.
  entrantId: string;
  entrantName: string;
  turnTimeLimit: number;
  turnStartedAt: Date;
  intervalId: NodeJS.Timeout;
  lastWarningAt?: number; // Tracks last warning to avoid duplicates
}

@Injectable()
export class GameTimerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(GameTimerService.name);
  private activeTimers = new Map<string, ActiveTimer>();

  constructor(
    @Inject(forwardRef(() => GameService))
    private readonly gameService: GameService,
    private readonly gameGateway: GameGateway,
  ) {}

  /**
   * Timers live only in this process's memory, so a restart/redeploy loses them
   * all — on single-replica hosting that means every in-flight turn timer dies
   * silently. Rebuild them from persisted turnStartedAt on boot; checkTimer
   * computes remaining time from that, so a countdown that already elapsed
   * fires expiry on the first tick.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const games = await this.gameService.getGamesNeedingTimer();
      let restored = 0;
      for (const game of games) {
        // The in-flight entrant is a team (team mode) or a player (individual).
        const entrant =
          game.currentTurnPlayerId != null
            ? (game.session?.players ?? []).find(
                (p) => p.id === game.currentTurnPlayerId,
              )
            : (game.teams ?? []).find((t) => t.id === game.currentTurnTeamId);
        if (entrant && game.turnTimeLimit && game.turnStartedAt) {
          this.startTimer(
            game.id,
            entrant.id,
            entrant.name,
            game.turnTimeLimit,
            game.turnStartedAt,
          );
          restored++;
        }
      }
      if (restored > 0) {
        this.logger.log(`Rehydrated ${restored} turn timer(s) after boot`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to rehydrate timers on boot: ${getErrorMessage(error)}`,
      );
    }
  }

  /** Clear every interval on shutdown so nothing leaks or fires post-exit. */
  onModuleDestroy(): void {
    this.stopAllTimers();
  }

  /**
   * Start a timer for a game turn
   */
  startTimer(
    gameId: string,
    entrantId: string,
    entrantName: string,
    turnTimeLimit: number,
    turnStartedAt: Date,
  ): void {
    // Stop existing timer if any
    this.stopTimer(gameId);

    this.logger.log(
      `Starting timer for game ${gameId}, entrant ${entrantName}, ${turnTimeLimit}s`,
    );

    // Create interval that ticks every second
    const intervalId = setInterval(() => {
      void this.checkTimer(gameId);
    }, TIME.TIMER_TICK_INTERVAL_MS);

    this.activeTimers.set(gameId, {
      gameId,
      entrantId,
      entrantName,
      turnTimeLimit,
      turnStartedAt,
      intervalId,
    });
  }

  /**
   * Stop a timer for a game
   */
  stopTimer(gameId: string): void {
    const timer = this.activeTimers.get(gameId);
    if (timer) {
      clearInterval(timer.intervalId);
      this.activeTimers.delete(gameId);
      this.logger.log(`Stopped timer for game ${gameId}`);
    }
  }

  /**
   * Check timer and emit events
   */
  private async checkTimer(gameId: string): Promise<void> {
    const timer = this.activeTimers.get(gameId);
    if (!timer) return;

    const elapsedMs = Date.now() - timer.turnStartedAt.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const remainingSeconds = timer.turnTimeLimit - elapsedSeconds;

    // Emit tick event
    const isWarning = (
      TIME.TIMER_WARNING_THRESHOLDS as readonly number[]
    ).includes(remainingSeconds);

    // Only emit warnings once
    if (isWarning && timer.lastWarningAt !== remainingSeconds) {
      this.gameGateway.broadcastTimerTick(gameId, remainingSeconds, true);
      timer.lastWarningAt = remainingSeconds;
      this.logger.log(
        `Timer warning for game ${gameId}: ${remainingSeconds}s remaining`,
      );
    } else if (!isWarning) {
      // Emit regular tick every few seconds to reduce noise
      if (remainingSeconds % TIME.TIMER_BROADCAST_INTERVAL_SECONDS === 0) {
        this.gameGateway.broadcastTimerTick(gameId, remainingSeconds, false);
      }
    }

    // Check if time is up
    if (remainingSeconds <= 0) {
      this.logger.log(`Timer expired for game ${gameId}`);
      await this.handleTimerExpired(gameId, timer);
    }
  }

  /**
   * Handle timer expiration and auto-advance
   */
  private async handleTimerExpired(
    gameId: string,
    timer: ActiveTimer,
  ): Promise<void> {
    // Stop the timer
    this.stopTimer(gameId);

    // Broadcast timer expired
    this.gameGateway.broadcastTimerExpired(
      gameId,
      timer.entrantId,
      timer.entrantName,
      true, // Will auto-advance
    );

    try {
      // Auto-advance to next turn. Pass auto: true so the advance is broadcast
      // as automatic (not a manual host tap). nextTurn re-arms the next turn's
      // timer itself (team and individual paths both call startTimer), so there
      // is no separate re-arm here.
      await this.gameService.nextTurn(gameId, undefined, true);

      this.logger.log(
        `Auto-advanced game ${gameId} to next turn after timeout`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to auto-advance game ${gameId}: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Get active timer count (for monitoring)
   */
  getActiveTimerCount(): number {
    return this.activeTimers.size;
  }

  /**
   * Stop all timers (for cleanup)
   */
  stopAllTimers(): void {
    this.activeTimers.forEach((timer) => clearInterval(timer.intervalId));
    this.activeTimers.clear();
    this.logger.log('Stopped all timers');
  }
}
