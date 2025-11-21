import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SessionService } from './session.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { JoinSessionDto } from './dto/join-session.dto';
import {
  AddGamesToSessionDto,
  RemoveGameFromSessionDto,
} from './dto/session-games.dto';
import {
  CreateTeamForSessionDto,
  AssignPlayersToTeamDto,
} from './dto/session-teams.dto';
import { Session } from './session.entity';
import { Team } from '../team/team.entity';
import { PlayerStatus } from '../player/player.entity';
import {
  SessionJoinResponseDto,
  SessionResponseDto,
  SessionSummaryDto,
} from '../common/dto/session.response';
import { PlayerResponseDto } from '../common/dto/player.response';
import { TeamResponseDto } from '../common/dto/team.response';
import { GameResponseDto } from '../common/dto/game.response';
import { SessionLeaderboardDto } from '../common/dto/session-leaderboard.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../user/user.entity';

@ApiTags('sessions')
@ApiBearerAuth()
@Controller('sessions')
export class SessionController {
  constructor(private readonly service: SessionService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GAMES_MASTER)
  @ApiOperation({ summary: 'Create a new session' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Session has been successfully created.',
    type: SessionResponseDto,
  })
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateSessionDto,
  ): Promise<SessionResponseDto> {
    // Verify the gamesMasterId matches the authenticated user's profile
    if (!user.gamesMasterProfile || dto.gamesMasterId !== user.gamesMasterProfile.id) {
      throw new ForbiddenException(
        'You can only create sessions for your own Games Master profile',
      );
    }

    return this.service
      .create(dto)
      .then((session) => this.service.findOne(session.id, ['host']))
      .then((session) => SessionResponseDto.fromEntity(session));
  }

  @Get()
  @ApiOperation({ summary: 'Get all sessions' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all sessions.',
    type: [SessionResponseDto],
  })
  findAll(): Promise<SessionResponseDto[]> {
    return this.service
      .findAll(['host', 'games', 'teams', 'players'])
      .then((sessions) =>
        sessions.map((session) => SessionResponseDto.fromEntity(session)),
      );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a session by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session found.',
    type: SessionResponseDto,
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionResponseDto> {
    return this.service
      .findOne(id, ['host', 'games', 'teams', 'players'])
      .then((session) => SessionResponseDto.fromEntity(session));
  }

  @Post(':id/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GAMES_MASTER)
  @ApiOperation({ summary: 'Start a session' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session started successfully.',
    type: SessionResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  async startSession(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionResponseDto> {
    // Verify ownership
    const session = await this.service.findOne(id, ['host']);
    if (!user.gamesMasterProfile || session.host.userId !== user.id) {
      throw new ForbiddenException(
        'You can only start your own sessions',
      );
    }

    return this.service
      .startSession(id)
      .then((session) =>
        this.service.findOne(session.id, ['host', 'games', 'teams', 'players']),
      )
      .then((session) => SessionResponseDto.fromEntity(session));
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GAMES_MASTER)
  @ApiOperation({ summary: 'Complete a session' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session completed successfully.',
    type: SessionResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  async completeSession(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionResponseDto> {
    // Verify ownership
    const session = await this.service.findOne(id, ['host']);
    if (!user.gamesMasterProfile || session.host.userId !== user.id) {
      throw new ForbiddenException(
        'You can only complete your own sessions',
      );
    }

    return this.service
      .completeSession(id)
      .then((session) =>
        this.service.findOne(session.id, ['host', 'games', 'teams', 'players']),
      )
      .then((session) => SessionResponseDto.fromEntity(session));
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GAMES_MASTER)
  @ApiOperation({ summary: 'Cancel a session' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session cancelled successfully.',
    type: SessionResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  async cancelSession(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionResponseDto> {
    // Verify ownership
    const session = await this.service.findOne(id, ['host']);
    if (!user.gamesMasterProfile || session.host.userId !== user.id) {
      throw new ForbiddenException(
        'You can only cancel your own sessions',
      );
    }

    return this.service
      .cancelSession(id)
      .then((session) =>
        this.service.findOne(session.id, ['host', 'games', 'teams', 'players']),
      )
      .then((session) => SessionResponseDto.fromEntity(session));
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GAMES_MASTER)
  @ApiOperation({ summary: 'Update a session' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session updated successfully.',
    type: SessionResponseDto,
  })
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSessionDto,
  ): Promise<SessionResponseDto> {
    // Verify ownership
    const session = await this.service.findOne(id, ['host']);
    if (!user.gamesMasterProfile || session.host.userId !== user.id) {
      throw new ForbiddenException(
        'You can only update your own sessions',
      );
    }

    return this.service
      .update(id, dto)
      .then((session) =>
        this.service.findOne(session.id, ['host', 'games', 'teams', 'players']),
      )
      .then((session) => SessionResponseDto.fromEntity(session));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GAMES_MASTER)
  @ApiOperation({ summary: 'Delete a session' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session deleted successfully.',
  })
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    // Verify ownership
    const session = await this.service.findOne(id, ['host']);
    if (!user.gamesMasterProfile || session.host.userId !== user.id) {
      throw new ForbiddenException(
        'You can only delete your own sessions',
      );
    }

    return this.service.remove(id);
  }

  @Get('join/:joinCode')
  @ApiOperation({ summary: 'Get session by join code' })
  @ApiParam({
    name: 'joinCode',
    type: 'string',
    description: '6-digit join code',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session found.',
    type: SessionResponseDto,
  })
  findByJoinCode(
    @Param('joinCode') joinCode: string,
  ): Promise<SessionResponseDto> {
    return this.service
      .findByJoinCode(joinCode)
      .then((session) => SessionResponseDto.fromEntity(session));
  }

  @Post('join')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Join a session using join code' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully joined session.',
  })
  joinSession(
    @CurrentUser() user: User | null,
    @Body() dto: JoinSessionDto,
  ): Promise<SessionJoinResponseDto> {
    return this.service
      .joinSession(dto, user?.id)
      .then(({ session, player, message }) =>
        SessionJoinResponseDto.fromEntities({
          session,
          playerId: player.id,
          playerName: player.name,
          message,
        }),
      );
  }

  // Game management endpoints
  @Post(':id/games')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GAMES_MASTER)
  @ApiOperation({ summary: 'Add games to a session' })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Session ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Games successfully added to session.',
    type: SessionResponseDto,
  })
  async addGamesToSession(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddGamesToSessionDto,
  ): Promise<SessionResponseDto> {
    // Verify ownership
    const session = await this.service.findOne(id, ['host']);
    if (!user.gamesMasterProfile || session.host.userId !== user.id) {
      throw new ForbiddenException(
        'You can only add games to your own sessions',
      );
    }

    return this.service
      .addGamesToSession(id, dto)
      .then((session) =>
        this.service.findOne(session.id, ['host', 'games', 'teams', 'players']),
      )
      .then((session) => SessionResponseDto.fromEntity(session));
  }

  @Delete(':id/games')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GAMES_MASTER)
  @ApiOperation({ summary: 'Remove a game from a session' })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Session ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Game successfully removed from session.',
    type: SessionResponseDto,
  })
  async removeGameFromSession(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemoveGameFromSessionDto,
  ): Promise<SessionResponseDto> {
    // Verify ownership
    const session = await this.service.findOne(id, ['host']);
    if (!user.gamesMasterProfile || session.host.userId !== user.id) {
      throw new ForbiddenException(
        'You can only remove games from your own sessions',
      );
    }

    return this.service
      .removeGameFromSession(id, dto)
      .then((session) =>
        this.service.findOne(session.id, ['host', 'games', 'teams', 'players']),
      )
      .then((session) => SessionResponseDto.fromEntity(session));
  }

  @Get(':id/validation')
  @ApiOperation({ summary: 'Validate player count for session games' })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Session ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Player count validation results.',
  })
  validatePlayerCount(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.validatePlayerCountForGames(id);
  }

  @Get(':id/can-start')
  @ApiOperation({ summary: 'Check if session can be started' })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Session ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session start readiness check.',
  })
  canStartSession(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.canStartSession(id);
  }

  @Get(':id/readiness')
  @ApiOperation({ summary: 'Get comprehensive session readiness status' })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Session ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Complete session readiness information.',
  })
  getSessionReadiness(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getSessionReadiness(id);
  }

  // Game management endpoints
  @Get(':id/games')
  @ApiOperation({ summary: 'Get all games for a session' })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Session ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of games for the session.',
    type: [GameResponseDto],
  })
  async getSessionGames(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GameResponseDto[]> {
    const session = await this.service.findOne(id, ['games']);
    return session.games.map((game) => GameResponseDto.fromEntity(game));
  }

  // Team management endpoints
  @Get(':id/teams')
  @ApiOperation({ summary: 'Get all teams for a session' })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Session ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of teams for the session.',
    type: [TeamResponseDto],
  })
  async getSessionTeams(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TeamResponseDto[]> {
    const session = await this.service.findOne(id, ['teams']);
    return session.teams.map((team) => TeamResponseDto.fromEntity(team));
  }

  @Post(':id/teams')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GAMES_MASTER)
  @ApiOperation({ summary: 'Create teams for a session' })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Session ID',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Team successfully created for session.',
    type: TeamResponseDto,
  })
  async createTeamForSession(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTeamForSessionDto,
  ): Promise<TeamResponseDto> {
    // Verify ownership
    const session = await this.service.findOne(id, ['host']);
    if (!user.gamesMasterProfile || session.host.userId !== user.id) {
      throw new ForbiddenException(
        'You can only create teams for your own sessions',
      );
    }

    return this.service
      .createTeamForSession(id, dto)
      .then((team) => TeamResponseDto.fromEntity(team));
  }

  @Put(':id/teams/:teamId/players')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GAMES_MASTER)
  @ApiOperation({ summary: 'Assign players to a team' })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Session ID',
  })
  @ApiParam({
    name: 'teamId',
    type: 'string',
    description: 'Team ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Players successfully assigned to team.',
    type: TeamResponseDto,
  })
  async assignPlayersToTeam(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: AssignPlayersToTeamDto,
  ): Promise<TeamResponseDto> {
    // Verify ownership
    const session = await this.service.findOne(id, ['host']);
    if (!user.gamesMasterProfile || session.host.userId !== user.id) {
      throw new ForbiddenException(
        'You can only assign players in your own sessions',
      );
    }

    return this.service
      .assignPlayersToTeam(id, teamId, dto)
      .then((team) => TeamResponseDto.fromEntity(team));
  }

  // Player status management endpoints
  @Post(':id/players/:playerId/ready')
  @ApiOperation({ summary: 'Set player ready status in session' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiParam({ name: 'playerId', description: 'Player ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Player ready status updated successfully.',
  })
  setPlayerReady(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @Body() dto: { ready: boolean },
  ) {
    return this.service.setPlayerReady(id, playerId, dto.ready);
  }

  @Put(':id/players/:playerId/status')
  @ApiOperation({ summary: 'Update player status in session' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiParam({ name: 'playerId', description: 'Player ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Player status updated successfully.',
  })
  updatePlayerStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @Body() dto: { status: PlayerStatus },
  ) {
    return this.service.updatePlayerStatus(id, playerId, dto.status);
  }

  @Get(':id/players')
  @ApiOperation({ summary: 'Get all players in session' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Players retrieved successfully.',
    type: [PlayerResponseDto],
  })
  getSessionPlayers(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlayerResponseDto[]> {
    return this.service
      .getSessionPlayers(id)
      .then((players) =>
        players.map((player) => PlayerResponseDto.fromEntity(player)),
      );
  }

  @Delete(':id/players/:playerId')
  @ApiOperation({ summary: 'Remove player from session' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiParam({ name: 'playerId', description: 'Player ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Player removed from session successfully.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  removePlayerFromSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('playerId', ParseUUIDPipe) playerId: string,
  ): Promise<void> {
    return this.service.removePlayerFromSession(id, playerId);
  }

  // Results and leaderboard endpoints
  @Get(':id/leaderboard')
  @ApiOperation({
    summary: 'Get session leaderboard with complete standings across all games',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Session ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session leaderboard retrieved successfully.',
    type: SessionLeaderboardDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found.',
  })
  getSessionLeaderboard(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionLeaderboardDto> {
    return this.service.getLeaderboard(id);
  }
}
