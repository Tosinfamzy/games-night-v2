import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Session } from './session.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { CreateSessionResponseDto } from './dto/create-session-response.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { GamesMaster } from '../games-master/games-master.entity';
import { SessionStatus } from './enums/session-status.enum';
import { Game } from '../game/game.entity';
import { GameStatus } from '../game/enums/game-status.enum';
import { generateJoinCode } from './utils/join-code.util';
import { JoinSessionDto } from './dto/join-session.dto';
import { GameLibrary } from '../game-library/game-library.entity';
import {
  AddGamesToSessionDto,
  RemoveGameFromSessionDto,
} from './dto/session-games.dto';
import {
  CreateTeamForSessionDto,
  AssignPlayersToTeamDto,
} from './dto/session-teams.dto';
import { PlayerStatus, Player } from '../player/player.entity';
import { Team } from '../team/team.entity';
import { SessionGateway } from './session.gateway';
import { ScoreService } from '../score/score.service';
import { SessionLeaderboardDto } from '../common/dto/session-leaderboard.dto';
import { AuthService } from '../auth/auth.service';
import { LIMITS } from '../common/constants';
import { SessionReadinessService } from './services/session-readiness.service';
import { SessionLifecycleService } from './services/session-lifecycle.service';
import { SessionPlayerService } from './services/session-player.service';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private readonly repo: Repository<Session>,
    @InjectRepository(GamesMaster)
    private readonly gamesMasterRepo: Repository<GamesMaster>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(GameLibrary)
    private readonly gameLibraryRepo: Repository<GameLibrary>,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @Inject(forwardRef(() => SessionGateway))
    private readonly sessionGateway: SessionGateway,
    @Inject(forwardRef(() => ScoreService))
    private readonly scoreService: ScoreService,
    private readonly authService: AuthService,
    private readonly readinessService: SessionReadinessService,
    @Inject(forwardRef(() => SessionLifecycleService))
    private readonly lifecycleService: SessionLifecycleService,
    @Inject(forwardRef(() => SessionPlayerService))
    private readonly playerService: SessionPlayerService,
  ) {}

  async create(dto: CreateSessionDto): Promise<CreateSessionResponseDto> {
    const host = await this.gamesMasterRepo.findOneBy({
      id: dto.gamesMasterId,
    });
    if (!host) {
      throw new NotFoundException(
        `GamesMaster with ID ${dto.gamesMasterId} not found`,
      );
    }

    // Generate unique join code
    let joinCode = generateJoinCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < LIMITS.JOIN_CODE_MAX_ATTEMPTS) {
      const existingSession = await this.repo.findOne({
        where: { joinCode },
      });
      if (!existingSession) {
        isUnique = true;
      } else {
        joinCode = generateJoinCode();
        attempts++;
      }
    }

    if (!isUnique) {
      throw new BadRequestException('Failed to generate unique join code');
    }

    const session = this.repo.create({
      name: dto.name,
      description: dto.description,
      date: dto.date,
      location: dto.location,
      host,
      status: SessionStatus.SCHEDULED,
      joinCode,
    });
    const savedSession = await this.repo.save(session);

    // AUTO-ENROLL GM AS PLAYER
    const gmPlayer = this.playerRepo.create({
      name: host.name,
      session: savedSession,
      status: PlayerStatus.JOINED,
      lastConnectedAt: new Date(),
      userId: host.id, // Link to GM's user ID for tracking
      isGuest: false,
    });
    const savedPlayer = await this.playerRepo.save(gmPlayer);

    // Reload session with player included
    const updatedSession = await this.findOne(savedSession.id, [
      'host',
      'players',
    ]);

    // Return response with player token
    return {
      session: updatedSession,
      gmPlayer: savedPlayer,
      message: `Session created successfully. You have been added as a player.`,

      playerToken: this.authService.generatePlayerToken(
        savedPlayer.id,
        updatedSession.id,
        savedPlayer.name,
      ),
    };
  }

  async findByJoinCode(joinCode: string): Promise<Session> {
    const session = await this.repo.findOne({
      where: { joinCode },
      relations: ['host', 'players', 'teams', 'games'],
    });

    if (!session) {
      throw new NotFoundException(
        `Session with join code ${joinCode} not found`,
      );
    }

    return session;
  }

  async joinSession(dto: JoinSessionDto, userId?: string) {
    return this.playerService.joinSession(dto, userId);
  }

  async rejoinSession(playerToken: string) {
    return this.playerService.rejoinSession(playerToken);
  }

  async findAll(relations: string[] = []): Promise<Session[]> {
    return this.repo.find({
      relations,
      order: { date: 'DESC' },
    });
  }

  async findOne(id: string, relations: string[] = []): Promise<Session> {
    const session = await this.repo.findOne({
      where: { id },
      relations,
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    return session;
  }

  async startSession(sessionId: string): Promise<Session> {
    return this.lifecycleService.startSession(sessionId);
  }

  async completeSession(id: string): Promise<Session> {
    return this.lifecycleService.completeSession(id);
  }

  async cancelSession(id: string): Promise<Session> {
    return this.lifecycleService.cancelSession(id);
  }

  async update(id: string, dto: UpdateSessionDto): Promise<Session> {
    const session = await this.findOne(id);

    if (dto.gamesMasterId) {
      const host = await this.gamesMasterRepo.findOneBy({
        id: dto.gamesMasterId,
      });
      if (!host) {
        throw new NotFoundException(
          `GamesMaster with ID ${dto.gamesMasterId} not found`,
        );
      }
      session.host = host;
    }

    Object.assign(session, {
      name: dto.name ?? session.name,
      description: dto.description ?? session.description,
      date: dto.date ?? session.date,
      location: dto.location ?? session.location,
    });

    return await this.repo.save(session);
  }

  /**
   * Regenerate the join code for a session
   * Useful for security/privacy if the old code was shared too widely
   */
  async regenerateJoinCode(id: string): Promise<Session> {
    const session = await this.findOne(id, ['host']);

    // Don't allow regeneration for completed or cancelled sessions
    if (
      session.status === SessionStatus.COMPLETED ||
      session.status === SessionStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot regenerate join code for ${session.status.toLowerCase()} session`,
      );
    }

    // Generate unique join code (same logic as create)
    let joinCode = generateJoinCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < LIMITS.JOIN_CODE_MAX_ATTEMPTS) {
      const existingSession = await this.repo.findOne({
        where: { joinCode },
      });
      if (!existingSession || existingSession.id === session.id) {
        isUnique = true;
      } else {
        joinCode = generateJoinCode();
        attempts++;
      }
    }

    if (!isUnique) {
      throw new BadRequestException('Failed to generate unique join code');
    }

    const oldJoinCode = session.joinCode;
    session.joinCode = joinCode;

    const updatedSession = await this.repo.save(session);

    // Broadcast join code changed event via WebSocket
    this.sessionGateway.server
      .to(`session:${id}`)
      .emit('session:join-code-changed', {
        sessionId: id,
        oldJoinCode,
        newJoinCode: joinCode,
        message: 'Session join code has been regenerated',
      });

    return updatedSession;
  }

  async remove(id: string): Promise<void> {
    const session = await this.findOne(id);
    await this.repo.remove(session);
  }

  async findByHost(hostId: string): Promise<Session[]> {
    return this.repo
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.host', 'host')
      .where('host.id = :hostId', { hostId })
      .orderBy('session.date', 'DESC')
      .getMany();
  }

  async findActiveSession(): Promise<Session | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.repo
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.host', 'host')
      .leftJoinAndSelect('session.players', 'players')
      .leftJoinAndSelect('session.teams', 'teams')
      .where('session.date = :today', { today })
      .orderBy('session.date', 'DESC')
      .getOne();
  }

  // Game management methods
  async addGamesToSession(
    sessionId: string,
    dto: AddGamesToSessionDto,
  ): Promise<Session> {
    const session = await this.findOne(sessionId, [
      'games',
      'games.gameLibrary',
    ]);

    // Verify all game library IDs exist
    const gameLibraries = await this.gameLibraryRepo.find({
      where: { id: In(dto.gameLibraryIds) },
    });
    if (gameLibraries.length !== dto.gameLibraryIds.length) {
      throw new NotFoundException('One or more game library IDs not found');
    }

    // Create Game instances from GameLibrary templates
    const newGames = gameLibraries.map((gameLibrary) =>
      this.gameRepo.create({
        name: gameLibrary.name,
        session,
        gameLibrary,
        status: GameStatus.PENDING,
        currentRound: 0,
        maxRounds: 1, // Default, can be configured later
      }),
    );

    await this.gameRepo.save(newGames);
    return this.findOne(sessionId, ['games', 'games.gameLibrary']);
  }

  async removeGameFromSession(
    sessionId: string,
    dto: RemoveGameFromSessionDto,
  ): Promise<Session> {
    await this.findOne(sessionId, ['games']); // Validate session exists
    const game = await this.gameRepo.findOne({
      where: { id: dto.gameId, session: { id: sessionId } },
    });

    if (!game) {
      throw new NotFoundException(
        `Game with ID ${dto.gameId} not found in session ${sessionId}`,
      );
    }

    if (game.status === GameStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot remove a game that is in progress');
    }

    await this.gameRepo.remove(game);
    return this.findOne(sessionId, ['games', 'games.gameLibrary']);
  }

  async updateSessionGames(
    sessionId: string,
    gameLibraryIds: string[],
  ): Promise<Session> {
    const session = await this.findOne(sessionId, ['games']);

    // Remove existing games that aren't in progress
    const gamesToRemove = session.games.filter(
      (game) => game.status !== GameStatus.IN_PROGRESS,
    );
    if (gamesToRemove.length > 0) {
      await this.gameRepo.remove(gamesToRemove);
    }

    // Add new games
    if (gameLibraryIds.length > 0) {
      const dto: AddGamesToSessionDto = { gameLibraryIds };
      return this.addGamesToSession(sessionId, dto);
    }

    return this.findOne(sessionId, ['games', 'games.gameLibrary']);
  }

  async validatePlayerCountForGames(sessionId: string) {
    return this.readinessService.validatePlayerCountForGames(sessionId);
  }

  async canStartSession(sessionId: string) {
    return this.readinessService.canStartSession(sessionId);
  }

  async getSessionReadiness(sessionId: string) {
    return this.readinessService.getSessionReadiness(sessionId);
  }

  // Team management methods
  async createTeamForSession(
    sessionId: string,
    dto: CreateTeamForSessionDto,
  ): Promise<Team> {
    const session = await this.findOne(sessionId, ['players']);

    // If gameId is provided, verify it exists in the session
    let game: Game | undefined = undefined;
    if (dto.gameId) {
      const foundGame = await this.gameRepo.findOne({
        where: { id: dto.gameId, session: { id: sessionId } },
      });
      if (!foundGame) {
        throw new NotFoundException(
          `Game with ID ${dto.gameId} not found in session ${sessionId}`,
        );
      }
      game = foundGame;
    }

    // Verify players exist in the session if provided
    let players: Player[] = [];
    if (dto.playerIds && dto.playerIds.length > 0) {
      players = await this.playerRepo
        .createQueryBuilder('player')
        .where('player.id IN (:...playerIds)', { playerIds: dto.playerIds })
        .andWhere('player.sessionId = :sessionId', { sessionId })
        .getMany();

      if (players.length !== dto.playerIds.length) {
        throw new NotFoundException(
          'One or more players not found in this session',
        );
      }
    }

    const team = this.teamRepo.create({
      name: dto.name,
      color: dto.color,
      session: session,
      game: game,
      players: players,
      position: 1, // Default position, can be adjusted later
    });

    const savedTeam = await this.teamRepo.save(team);

    // Broadcast team created
    this.sessionGateway.broadcastTeamCreated(sessionId, savedTeam);

    return savedTeam;
  }

  async assignPlayersToTeam(
    sessionId: string,
    teamId: string,
    dto: AssignPlayersToTeamDto,
  ): Promise<Team> {
    // Verify team exists and belongs to the session
    const team = await this.teamRepo.findOne({
      where: { id: teamId, session: { id: sessionId } },
      relations: ['session', 'players'],
    });

    if (!team) {
      throw new NotFoundException(
        `Team with ID ${teamId} not found in session ${sessionId}`,
      );
    }

    // Verify all players exist in the session
    const players = await this.playerRepo
      .createQueryBuilder('player')
      .where('player.id IN (:...playerIds)', { playerIds: dto.playerIds })
      .andWhere('player.sessionId = :sessionId', { sessionId })
      .getMany();

    if (players.length !== dto.playerIds.length) {
      throw new NotFoundException(
        'One or more players not found in this session',
      );
    }

    // Update team with new players (replacing existing ones)
    team.players = players;
    const savedTeam = await this.teamRepo.save(team);

    // Broadcast player assignments and team update
    for (const player of players) {
      this.sessionGateway.broadcastPlayerAssignedToTeam(
        sessionId,
        teamId,
        player.id,
      );
    }

    this.sessionGateway.broadcastTeamUpdated(sessionId, savedTeam);

    return savedTeam;
  }

  // Player status management methods (delegated to SessionPlayerService)
  async setPlayerReady(
    sessionId: string,
    playerId: string,
    ready: boolean = true,
  ): Promise<Player> {
    return this.playerService.setPlayerReady(sessionId, playerId, ready);
  }

  async updatePlayerStatus(
    sessionId: string,
    playerId: string,
    status: PlayerStatus,
  ): Promise<Player> {
    return this.playerService.updatePlayerStatus(sessionId, playerId, status);
  }

  async getSessionPlayers(sessionId: string): Promise<Player[]> {
    return this.playerService.getSessionPlayers(sessionId);
  }

  async removePlayerFromSession(
    sessionId: string,
    playerId: string,
  ): Promise<void> {
    return this.playerService.removePlayerFromSession(sessionId, playerId);
  }

  /**
   * Get session leaderboard with complete standings across all games
   */
  async getLeaderboard(id: string): Promise<SessionLeaderboardDto> {
    const session = await this.findOne(id, ['games']);

    // Get leaderboard data from score service
    const leaderboardData = await this.scoreService.getSessionLeaderboard(id);

    // Count completed games
    const completedGames =
      session.games?.filter((game) => game.status === GameStatus.COMPLETED)
        .length || 0;

    // Determine champion (team with highest total points)
    const champion = leaderboardData.length > 0 ? leaderboardData[0] : null;

    // Build standings with ranks
    const standings = leaderboardData.map((team, index) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      rank: index + 1,
      totalPoints: team.totalPoints,
      gamesWon: team.gamesWon,
      gamesPlayed: team.gamesPlayed,
      gamePoints: team.gamePoints,
      averagePoints:
        team.gamesPlayed > 0 ? team.totalPoints / team.gamesPlayed : 0,
    }));

    return {
      sessionId: session.id,
      sessionName: session.name,
      status: session.status,
      championId: champion?.teamId || null,
      championName: champion?.teamName || null,
      standings,
      gamesCompleted: completedGames,
      teamsCount: leaderboardData.length,
      completedAt: session.updatedAt.toISOString(),
    };
  }

  async kickPlayer(sessionId: string, playerId: string): Promise<Session> {
    return this.playerService.kickPlayer(sessionId, playerId);
  }
}
