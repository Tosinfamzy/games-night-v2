import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../session.entity';
import { Game } from '../../game/game.entity';
import { Player, PlayerStatus } from '../../player/player.entity';
import { isActivePlayer } from '../../common/utils/player-status.util';
import { SessionStatus } from '../enums/session-status.enum';
import { GameStatus } from '../../game/enums/game-status.enum';
import { SessionGateway } from '../session.gateway';
import { SessionReadinessService } from './session-readiness.service';

@Injectable()
export class SessionLifecycleService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    @Inject(forwardRef(() => SessionGateway))
    private readonly sessionGateway: SessionGateway,
    private readonly readinessService: SessionReadinessService,
  ) {}

  /**
   * Start a session - validates readiness, updates player statuses, broadcasts
   */
  async startSession(sessionId: string): Promise<Session> {
    const startCheck = await this.readinessService.canStartSession(sessionId);

    if (!startCheck.canStart) {
      throw new BadRequestException(
        `Cannot start session: ${startCheck.reasons.join(', ')}`,
      );
    }

    const session = await this.findOne(sessionId, ['players']);

    // Update session status
    session.status = SessionStatus.IN_PROGRESS;

    // Set all ready players to playing status
    const activePlayers = session.players.filter(isActivePlayer);

    for (const player of activePlayers) {
      if (player.status === PlayerStatus.READY) {
        player.status = PlayerStatus.PLAYING;
        await this.playerRepo.save(player);
      }
    }

    const savedSession = await this.sessionRepo.save(session);

    // Broadcast session started event
    this.sessionGateway.broadcastSessionStatusChange(
      sessionId,
      SessionStatus.IN_PROGRESS,
      savedSession,
    );

    return this.findOne(sessionId, [
      'games',
      'games.gameLibrary',
      'players',
      'host',
    ]);
  }

  /**
   * Complete a session - validates all games are done, broadcasts
   */
  async completeSession(id: string): Promise<Session> {
    const session = await this.findOne(id, ['games']);

    if (session.status !== SessionStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Session cannot be completed. Current status: ${session.status}`,
      );
    }

    // Check if all games are completed or cancelled
    const incompleteGames = session.games?.filter(
      (game) =>
        ![GameStatus.COMPLETED, GameStatus.CANCELLED].includes(game.status),
    );

    if (incompleteGames?.length) {
      throw new BadRequestException(
        `Cannot complete session. ${incompleteGames.length} games are still in progress.`,
      );
    }

    session.status = SessionStatus.COMPLETED;
    const savedSession = await this.sessionRepo.save(session);

    // Broadcast session completed event
    this.sessionGateway.broadcastSessionStatusChange(
      id,
      SessionStatus.COMPLETED,
      savedSession,
    );

    return savedSession;
  }

  /**
   * Cancel a session - cancels all active games, broadcasts
   */
  async cancelSession(id: string): Promise<Session> {
    const session = await this.findOne(id, ['games']);

    if (
      [SessionStatus.COMPLETED, SessionStatus.CANCELLED].includes(
        session.status,
      )
    ) {
      throw new BadRequestException(
        `Session cannot be cancelled. Current status: ${session.status}`,
      );
    }

    // Cancel all in-progress games
    if (session.games?.length) {
      const activeGames = session.games.filter(
        (game) =>
          ![GameStatus.COMPLETED, GameStatus.CANCELLED].includes(game.status),
      );

      await Promise.all(
        activeGames.map((game) => {
          game.status = GameStatus.CANCELLED;
          return this.gameRepo.save(game);
        }),
      );
    }

    session.status = SessionStatus.CANCELLED;
    const savedSession = await this.sessionRepo.save(session);

    // Broadcast session cancelled event
    this.sessionGateway.broadcastSessionStatusChange(
      id,
      SessionStatus.CANCELLED,
      savedSession,
    );

    return savedSession;
  }

  /**
   * Find a session by ID with optional relations
   * Helper method to avoid circular dependency with SessionService
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
