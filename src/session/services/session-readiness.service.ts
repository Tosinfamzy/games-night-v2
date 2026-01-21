import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../session.entity';
import { Player, PlayerStatus } from '../../player/player.entity';
import { SessionStatus } from '../enums/session-status.enum';

export interface PlayerCountValidation {
  isValid: boolean;
  errors: string[];
  playerCount: number;
  gameRequirements: Array<{
    gameName: string;
    minPlayers: number;
    maxPlayers: number;
    isValidForCurrentPlayers: boolean;
  }>;
}

export interface StartCheck {
  canStart: boolean;
  reasons: string[];
  checks: {
    hasGames: boolean;
    playersReady: boolean;
    playerCountValid: boolean;
    sessionScheduled: boolean;
  };
}

export interface SessionReadinessStatus {
  sessionId: string;
  totalPlayers: number;
  readyPlayers: number;
  allReady: boolean;
  playersStatus: Array<{
    playerId: string;
    playerName: string;
    isReady: boolean;
    status: PlayerStatus;
  }>;
  session: {
    id: string;
    name: string;
    status: SessionStatus;
    joinCode: string;
  };
  players: {
    total: number;
    active: number;
    ready: number;
    joined: number;
    playing: number;
  };
  games: Array<{
    id: string;
    name: string;
    minPlayers: number;
    maxPlayers: number;
    status: string;
  }>;
  validation: PlayerCountValidation;
  readiness: StartCheck;
}

@Injectable()
export class SessionReadinessService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
  ) {}

  /**
   * Fetch session with required relations for readiness checks
   */
  private async getSessionWithRelations(sessionId: string): Promise<Session> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['games', 'games.gameLibrary', 'players'],
    });

    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    return session;
  }

  /**
   * Validate that the current player count is valid for all games in the session
   */
  async validatePlayerCountForGames(
    sessionId: string,
  ): Promise<PlayerCountValidation> {
    const session = await this.getSessionWithRelations(sessionId);

    const activePlayerCount = session.players.filter(
      (player) => player.status !== PlayerStatus.DISCONNECTED,
    ).length;

    const errors: string[] = [];
    const gameRequirements: PlayerCountValidation['gameRequirements'] = [];

    for (const game of session.games) {
      const { minPlayers, maxPlayers, name } = game.gameLibrary;
      const isValidForCurrentPlayers =
        activePlayerCount >= minPlayers && activePlayerCount <= maxPlayers;

      gameRequirements.push({
        gameName: name,
        minPlayers,
        maxPlayers,
        isValidForCurrentPlayers,
      });

      if (!isValidForCurrentPlayers) {
        errors.push(
          `${name} requires ${minPlayers}-${maxPlayers} players, but ${activePlayerCount} active players in session`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      playerCount: activePlayerCount,
      gameRequirements,
    };
  }

  /**
   * Check if a session can be started
   * Returns detailed information about what conditions are met/unmet
   */
  async canStartSession(sessionId: string): Promise<StartCheck> {
    const session = await this.getSessionWithRelations(sessionId);

    const reasons: string[] = [];
    const checks = {
      hasGames: session.games.length > 0,
      playersReady: false,
      playerCountValid: false,
      sessionScheduled: session.status === SessionStatus.SCHEDULED,
    };

    // Check if session has games
    if (!checks.hasGames) {
      reasons.push('Session must have at least one game selected');
    }

    // Check if session is in correct status
    if (!checks.sessionScheduled) {
      reasons.push(
        `Session status must be SCHEDULED, current: ${session.status}`,
      );
    }

    // Check if all players are ready
    const activePlayers = session.players.filter(
      (player) => player.status !== PlayerStatus.DISCONNECTED,
    );
    checks.playersReady =
      activePlayers.length > 0 &&
      activePlayers.every((player) => player.status === PlayerStatus.READY);

    if (!checks.playersReady) {
      const readyCount = activePlayers.filter(
        (p) => p.status === PlayerStatus.READY,
      ).length;
      reasons.push(
        `All players must be ready. Currently ${readyCount}/${activePlayers.length} players ready`,
      );
    }

    // Check player count validity for all games
    if (checks.hasGames) {
      const validation = await this.validatePlayerCountForGames(sessionId);
      checks.playerCountValid = validation.isValid;

      if (!validation.isValid) {
        reasons.push(...validation.errors);
      }
    }

    return {
      canStart:
        checks.hasGames &&
        checks.playersReady &&
        checks.playerCountValid &&
        checks.sessionScheduled,
      reasons,
      checks,
    };
  }

  /**
   * Get comprehensive readiness status for a session
   * Used by frontend to display readiness dashboard
   */
  async getSessionReadiness(
    sessionId: string,
  ): Promise<SessionReadinessStatus> {
    const session = await this.getSessionWithRelations(sessionId);

    const activePlayers = session.players.filter(
      (player) => player.status !== PlayerStatus.DISCONNECTED,
    );

    const playerStats = {
      total: session.players.length,
      active: activePlayers.length,
      ready: activePlayers.filter((p) => p.status === PlayerStatus.READY)
        .length,
      joined: activePlayers.filter((p) => p.status === PlayerStatus.JOINED)
        .length,
      playing: activePlayers.filter((p) => p.status === PlayerStatus.PLAYING)
        .length,
    };

    const gameValidation = await this.validatePlayerCountForGames(sessionId);
    const startCheck = await this.canStartSession(sessionId);

    return {
      // Frontend-expected top-level fields
      sessionId: session.id,
      totalPlayers: session.players.length,
      readyPlayers: activePlayers.filter((p) => p.status === PlayerStatus.READY)
        .length,
      allReady:
        activePlayers.length > 0 &&
        activePlayers.every((p) => p.status === PlayerStatus.READY),
      playersStatus: activePlayers.map((p) => ({
        playerId: p.id,
        playerName: p.name,
        isReady: p.status === PlayerStatus.READY,
        status: p.status,
      })),
      // Backward compatibility fields
      session: {
        id: session.id,
        name: session.name,
        status: session.status,
        joinCode: session.joinCode,
      },
      players: playerStats,
      games: session.games.map((game) => ({
        id: game.id,
        name: game.gameLibrary.name,
        minPlayers: game.gameLibrary.minPlayers,
        maxPlayers: game.gameLibrary.maxPlayers,
        status: game.status,
      })),
      validation: gameValidation,
      readiness: startCheck,
    };
  }
}
