import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GamesMaster } from './games-master.entity';
import { LIMITS } from '../common/constants';
import { generateUniqueCode } from '../common/utils/unique-code.util';
import { CreateGamesMasterDto } from './dto/create-games-master.dto';
import { UpdateGamesMasterDto } from './dto/update-games-master.dto';
import {
  GamesMasterDashboardDto,
  DashboardSessionDto,
  DashboardGameDto,
  DashboardPlayerDto,
  DashboardStatsDto,
} from './dto/dashboard.dto';
import { SessionStatus } from '../session/enums/session-status.enum';
import { GameStatus } from '../game/enums/game-status.enum';

@Injectable()
export class GamesMasterService {
  constructor(
    @InjectRepository(GamesMaster)
    private readonly repo: Repository<GamesMaster>,
  ) {}

  /**
   * Generate a unique 6-character host code
   * Uses uppercase letters and numbers (excluding confusing characters like O, 0, I, 1)
   */
  private generateHostCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join('');
  }

  /**
   * Generate a unique host code (retry if collision)
   */
  private async generateUniqueHostCode(): Promise<string> {
    const code = await generateUniqueCode(
      () => this.generateHostCode(),
      async (candidate) =>
        (await this.repo.findOne({ where: { hostCode: candidate } })) !== null,
      LIMITS.JOIN_CODE_MAX_ATTEMPTS,
    );

    if (!code) {
      throw new InternalServerErrorException(
        'Failed to generate unique host code',
      );
    }

    return code;
  }

  async create(dto: CreateGamesMasterDto): Promise<GamesMaster> {
    const hostCode = await this.generateUniqueHostCode();
    const gm = this.repo.create({ ...dto, hostCode });
    return await this.repo.save(gm);
  }

  async findAll(relations: string[] = []): Promise<GamesMaster[]> {
    return this.repo.find({
      relations,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, relations: string[] = []): Promise<GamesMaster> {
    const gm = await this.repo.findOne({
      where: { id },
      relations,
    });

    if (!gm) {
      throw new NotFoundException(`GamesMaster with ID ${id} not found`);
    }

    return gm;
  }

  async findByName(name: string): Promise<GamesMaster[]> {
    return this.repo.find({
      where: { name },
      order: { createdAt: 'DESC' },
    });
  }

  async findByCode(hostCode: string): Promise<GamesMaster> {
    const gm = await this.repo.findOne({
      where: { hostCode },
    });

    if (!gm) {
      throw new NotFoundException(
        `GamesMaster with host code ${hostCode} not found`,
      );
    }

    return gm;
  }

  async update(id: string, dto: UpdateGamesMasterDto): Promise<GamesMaster> {
    const gm = await this.findOne(id);

    Object.assign(gm, {
      name: dto.name ?? gm.name,
    });

    return this.repo.save(gm);
  }

  async delete(id: string): Promise<void> {
    const gm = await this.findOne(id);
    await this.repo.remove(gm);
  }

  async findWithActiveSessions(id: string): Promise<GamesMaster> {
    const gm = await this.repo.findOne({
      where: { id },
      relations: ['sessions'],
      order: {
        sessions: { date: 'DESC' },
      },
    });

    if (!gm) {
      throw new NotFoundException(`GamesMaster with ID ${id} not found`);
    }

    return gm;
  }

  async getDashboard(id: string): Promise<GamesMasterDashboardDto> {
    const gm = await this.repo.findOne({
      where: { id },
      relations: [
        'sessions',
        'sessions.players',
        'sessions.games',
        'sessions.games.teams',
        'sessions.games.teams.players',
      ],
    });

    if (!gm) {
      throw new NotFoundException(`GamesMaster with ID ${id} not found`);
    }

    // Build sessions data
    const sessions: DashboardSessionDto[] = gm.sessions.map((session) => {
      const games: DashboardGameDto[] = session.games.map((game) => {
        const currentTurnTeam = game.teams?.find(
          (team) => team.id === game.currentTurnTeamId,
        );

        return {
          id: game.id,
          name: game.name,
          status: game.status,
          currentRound: game.currentRound,
          maxRounds: game.maxRounds,
          teamsCount: game.teams?.length || 0,
          currentTurnTeamId: game.currentTurnTeamId,
          currentTurnTeamName: currentTurnTeam?.name,
          turnStartedAt: game.turnStartedAt,
          turnTimeLimit: game.turnTimeLimit,
          winnerId: game.winnerId,
          createdAt: game.createdAt,
        };
      });

      const players: DashboardPlayerDto[] = session.players.map((player) => {
        // Find player's team (if any) in any game
        let teamId: string | undefined;
        let teamName: string | undefined;

        for (const game of session.games) {
          for (const team of game.teams || []) {
            if (team.players?.some((p) => p.id === player.id)) {
              teamId = team.id;
              teamName = team.name;
              break;
            }
          }
          if (teamId) break;
        }

        return {
          id: player.id,
          name: player.name,
          avatarUrl: undefined, // TODO: Fetch from User via userId
          isOnline: player.isOnline,
          teamId,
          teamName,
        };
      });

      const gamesInProgress = games.filter(
        (g) =>
          g.status === GameStatus.IN_PROGRESS ||
          g.status === GameStatus.ROUND_IN_PROGRESS,
      ).length;
      const gamesCompleted = games.filter(
        (g) => g.status === GameStatus.COMPLETED,
      ).length;

      return {
        id: session.id,
        name: session.name,
        status: session.status,
        location: session.location,
        scheduledFor: session.date,
        playersCount: session.players?.length || 0,
        players,
        games,
        gamesInProgress,
        gamesCompleted,
      };
    });

    // Calculate overall stats
    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(
      (s) =>
        s.status === SessionStatus.SCHEDULED ||
        s.status === SessionStatus.IN_PROGRESS,
    ).length;

    const totalPlayers = sessions.reduce(
      (sum, session) => sum + session.playersCount,
      0,
    );
    const onlinePlayers = sessions.reduce(
      (sum, session) => sum + session.players.filter((p) => p.isOnline).length,
      0,
    );

    const totalGames = sessions.reduce(
      (sum, session) => sum + session.games.length,
      0,
    );
    const gamesInProgress = sessions.reduce(
      (sum, session) => sum + session.gamesInProgress,
      0,
    );
    const gamesCompleted = sessions.reduce(
      (sum, session) => sum + session.gamesCompleted,
      0,
    );

    const stats: DashboardStatsDto = {
      totalSessions,
      activeSessions,
      totalPlayers,
      onlinePlayers,
      totalGames,
      gamesInProgress,
      gamesCompleted,
    };

    return {
      gamesMasterId: gm.id,
      gamesMasterName: gm.name,
      stats,
      sessions,
      lastUpdated: new Date(),
    };
  }
}
