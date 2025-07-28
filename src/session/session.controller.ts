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

@ApiTags('sessions')
@ApiBearerAuth()
@Controller('sessions')
export class SessionController {
  constructor(private readonly service: SessionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new session' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Session has been successfully created.',
    type: Session,
  })
  create(@Body() dto: CreateSessionDto): Promise<Session> {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sessions' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all sessions.',
    type: [Session],
  })
  findAll(): Promise<Session[]> {
    return this.service.findAll(['games', 'teams', 'players']);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a session by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session found.',
    type: Session,
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Session> {
    return this.service.findOne(id, ['games', 'teams', 'players']);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start a session' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session started successfully.',
    type: Session,
  })
  @HttpCode(HttpStatus.OK)
  startSession(@Param('id', ParseUUIDPipe) id: string): Promise<Session> {
    return this.service.startSession(id);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a session' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session completed successfully.',
    type: Session,
  })
  @HttpCode(HttpStatus.OK)
  completeSession(@Param('id', ParseUUIDPipe) id: string): Promise<Session> {
    return this.service.completeSession(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a session' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session cancelled successfully.',
    type: Session,
  })
  @HttpCode(HttpStatus.OK)
  cancelSession(@Param('id', ParseUUIDPipe) id: string): Promise<Session> {
    return this.service.cancelSession(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a session' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session updated successfully.',
    type: Session,
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSessionDto,
  ): Promise<Session> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a session' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session deleted successfully.',
  })
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
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
    type: Session,
  })
  findByJoinCode(@Param('joinCode') joinCode: string): Promise<Session> {
    return this.service.findByJoinCode(joinCode);
  }

  @Post('join')
  @ApiOperation({ summary: 'Join a session using join code' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully joined session.',
  })
  joinSession(
    @Body() dto: JoinSessionDto,
  ): Promise<{ session: Session; player: any; message: string }> {
    return this.service.joinSession(dto);
  }

  // Game management endpoints
  @Post(':id/games')
  @ApiOperation({ summary: 'Add games to a session' })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Session ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Games successfully added to session.',
    type: Session,
  })
  addGamesToSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddGamesToSessionDto,
  ): Promise<Session> {
    return this.service.addGamesToSession(id, dto);
  }

  @Delete(':id/games')
  @ApiOperation({ summary: 'Remove a game from a session' })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Session ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Game successfully removed from session.',
    type: Session,
  })
  removeGameFromSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemoveGameFromSessionDto,
  ): Promise<Session> {
    return this.service.removeGameFromSession(id, dto);
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

  // Team management endpoints
  @Post(':id/teams')
  @ApiOperation({ summary: 'Create teams for a session' })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Session ID',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Team successfully created for session.',
    type: Team,
  })
  createTeamForSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTeamForSessionDto,
  ): Promise<Team> {
    return this.service.createTeamForSession(id, dto);
  }

  @Put(':id/teams/:teamId/players')
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
    type: Team,
  })
  assignPlayersToTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: AssignPlayersToTeamDto,
  ): Promise<Team> {
    return this.service.assignPlayersToTeam(id, teamId, dto);
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
  })
  getSessionPlayers(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getSessionPlayers(id);
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
}
