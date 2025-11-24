import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';

interface ActiveTimer {
  gameId: string;
  teamId: string;
  teamName: string;
  turnTimeLimit: number;
  turnStartedAt: Date;
  intervalId: NodeJS.Timeout;
  lastWarningAt?: number; // Tracks last warning to avoid duplicates
}

@Injectable()
export class GameTimerService {
  private readonly logger = new Logger(GameTimerService.name);
  private activeTimers = new Map<string, ActiveTimer>();

  constructor(
    @Inject(forwardRef(() => GameService))
    private readonly gameService: GameService,
    private readonly gameGateway: GameGateway,
  ) {}

  /**
   * Start a timer for a game turn
   */
  startTimer(
    gameId: string,
    teamId: string,
    teamName: string,
    turnTimeLimit: number,
    turnStartedAt: Date,
  ): void {
    // Stop existing timer if any
    this.stopTimer(gameId);

    this.logger.log(
      `Starting timer for game ${gameId}, team ${teamName}, ${turnTimeLimit}s`,
    );

    // Create interval that ticks every second
    const intervalId = setInterval(() => {
      this.checkTimer(gameId);
    }, 1000); // Check every second

    this.activeTimers.set(gameId, {
      gameId,
      teamId,
      teamName,
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
    const isWarning = [30, 10, 5].includes(remainingSeconds);

    // Only emit warnings once
    if (isWarning && timer.lastWarningAt !== remainingSeconds) {
      this.gameGateway.broadcastTimerTick(gameId, remainingSeconds, true);
      timer.lastWarningAt = remainingSeconds;
      this.logger.log(
        `Timer warning for game ${gameId}: ${remainingSeconds}s remaining`,
      );
    } else if (!isWarning) {
      // Emit regular tick every 5 seconds to reduce noise
      if (remainingSeconds % 5 === 0) {
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
      timer.teamId,
      timer.teamName,
      true, // Will auto-advance
    );

    try {
      // Auto-advance to next turn
      const game = await this.gameService.nextTurn(gameId);

      this.logger.log(
        `Auto-advanced game ${gameId} to next turn after timeout`,
      );

      // If the new turn also has a timer, start it
      if (game.turnTimeLimit && game.turnStartedAt && game.currentTurnTeamId) {
        // Get team name for the new turn
        const teams = await this.gameService['teamService'].findByGame(gameId);
        const newTeam = teams.find((t) => t.id === game.currentTurnTeamId);

        if (newTeam) {
          this.startTimer(
            gameId,
            game.currentTurnTeamId,
            newTeam.name,
            game.turnTimeLimit,
            game.turnStartedAt,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to auto-advance game ${gameId}: ${error.message}`,
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
