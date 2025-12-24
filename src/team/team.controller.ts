import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import {
  CreateTeamsDto,
  AssignPlayersDto,
  TeamFormationStrategy,
} from './dto/team-formation.dto';
import { SwapPlayerDto, ReassignPlayerDto } from './dto/team-management.dto';
import { TeamResponseDto } from '../common/dto/team.response';

@ApiTags('teams')
@Controller('teams')
export class TeamController {
  constructor(private readonly service: TeamService) {}

  @Post()
  @ApiOperation({ summary: 'Create a team' })
  @ApiResponse({
    status: 201,
    description: 'Team created successfully',
    type: TeamResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Game not found' })
  create(@Body() dto: CreateTeamDto): Promise<TeamResponseDto> {
    return this.service
      .create(dto)
      .then((team) =>
        this.service.findOne(team.id, ['session', 'game', 'players', 'scores']),
      )
      .then((team) => TeamResponseDto.fromEntity(team));
  }

  @Get()
  @ApiOperation({ summary: 'Get all teams' })
  @ApiResponse({
    status: 200,
    description: 'List of all teams',
    type: [TeamResponseDto],
  })
  findAll(): Promise<TeamResponseDto[]> {
    return this.service
      .findAll()
      .then((teams) => teams.map((team) => TeamResponseDto.fromEntity(team)));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a team by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Team found',
    type: TeamResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Team not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TeamResponseDto> {
    const team = await this.service.findOne(id, [
      'game',
      'players',
      'session',
      'scores',
    ]);
    return TeamResponseDto.fromEntity(team);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a team' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Team updated',
    type: TeamResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Team not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
  ): Promise<TeamResponseDto> {
    return this.service
      .update(id, dto)
      .then((team) =>
        this.service.findOne(team.id, ['session', 'game', 'players', 'scores']),
      )
      .then((team) => TeamResponseDto.fromEntity(team));
  }

  @Delete(':id/dissolve')
  @ApiOperation({
    summary: 'Dissolve a team and return its players to the unassigned pool',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Team dissolved successfully',
  })
  @ApiNotFoundResponse({ description: 'Team not found' })
  @HttpCode(HttpStatus.OK)
  async dissolveTeam(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.service.dissolveTeam(id);
    return { message: 'Team dissolved successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a team' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Team deleted successfully' })
  @ApiNotFoundResponse({ description: 'Team not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.delete(id);
  }

  @Get('game/:gameId')
  @ApiOperation({ summary: 'Get all teams for a game' })
  @ApiParam({ name: 'gameId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'List of teams for the game',
    type: [TeamResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Game not found' })
  async findByGame(
    @Param('gameId', ParseUUIDPipe) gameId: string,
  ): Promise<TeamResponseDto[]> {
    return this.service
      .findByGame(gameId)
      .then((teams) => teams.map((team) => TeamResponseDto.fromEntity(team)));
  }

  @Post('game/:gameId/create-teams')
  @ApiOperation({ summary: 'Create teams for a game with automatic formation' })
  @ApiParam({ name: 'gameId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Teams created successfully',
    type: [TeamResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Game not found' })
  async createTeamsForGame(
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Body() dto: CreateTeamsDto,
  ): Promise<TeamResponseDto[]> {
    return this.service
      .createTeamsForGame(gameId, dto)
      .then((teams) => teams.map((team) => TeamResponseDto.fromEntity(team)));
  }

  @Put('game/:gameId/assign-players')
  @ApiOperation({ summary: 'Manually assign players to teams' })
  @ApiParam({ name: 'gameId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Players assigned successfully',
    type: [TeamResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Game or teams not found' })
  async manualAssignPlayers(
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Body() dto: AssignPlayersDto,
  ): Promise<TeamResponseDto[]> {
    return this.service
      .manualAssignPlayers(gameId, dto)
      .then((teams) => teams.map((team) => TeamResponseDto.fromEntity(team)));
  }

  @Get('game/:gameId/stats')
  @ApiOperation({ summary: 'Get team statistics for a game' })
  @ApiParam({ name: 'gameId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Team statistics',
  })
  async getTeamStats(@Param('gameId', ParseUUIDPipe) gameId: string) {
    return this.service.getTeamStats(gameId);
  }

  @Delete('game/:gameId/clear')
  @ApiOperation({ summary: 'Clear all teams for a game' })
  @ApiParam({ name: 'gameId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Teams cleared successfully',
  })
  @ApiNotFoundResponse({ description: 'Game not found' })
  async clearTeamsForGame(
    @Param('gameId', ParseUUIDPipe) gameId: string,
  ): Promise<{ message: string }> {
    await this.service.clearTeamsForGame(gameId);
    return { message: 'Teams cleared successfully' };
  }

  @Get('game/:gameId/suggestions')
  @ApiOperation({ summary: 'Get team formation suggestions for a game' })
  @ApiParam({ name: 'gameId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Team formation suggestions with validation',
  })
  @ApiNotFoundResponse({ description: 'Game not found' })
  async suggestTeamFormation(@Param('gameId', ParseUUIDPipe) gameId: string) {
    return this.service.suggestTeamFormation(gameId);
  }

  @Put('game/:gameId/rebalance')
  @ApiOperation({
    summary: 'Rebalance existing teams using a different strategy',
  })
  @ApiParam({ name: 'gameId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Teams rebalanced successfully',
    type: [TeamResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Game or teams not found' })
  async rebalanceTeams(
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Body() body: { strategy?: 'automatic' | 'balanced' | 'random' | 'manual' },
  ): Promise<TeamResponseDto[]> {
    const strategy =
      TeamFormationStrategy[
        (body.strategy?.toUpperCase() ||
          'BALANCED') as keyof typeof TeamFormationStrategy
      ] || TeamFormationStrategy.BALANCED;
    return this.service
      .rebalanceTeams(gameId, strategy)
      .then((teams) => teams.map((team) => TeamResponseDto.fromEntity(team)));
  }

  @Put('game/:gameId/shuffle')
  @ApiOperation({
    summary: 'Shuffle players randomly across existing teams',
  })
  @ApiParam({ name: 'gameId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Players shuffled successfully',
    type: [TeamResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Game or teams not found' })
  async shufflePlayers(
    @Param('gameId', ParseUUIDPipe) gameId: string,
  ): Promise<TeamResponseDto[]> {
    return this.service
      .shufflePlayers(gameId)
      .then((teams) => teams.map((team) => TeamResponseDto.fromEntity(team)));
  }

  @Post('swap-player')
  @ApiOperation({ summary: 'Swap a player from one team to another' })
  @ApiResponse({
    status: 200,
    description: 'Player swapped successfully',
    type: TeamResponseDto,
    isArray: true,
  })
  @ApiNotFoundResponse({ description: 'Team or player not found' })
  @ApiBadRequestResponse({
    description: 'Player not in source team or teams from different games',
  })
  @HttpCode(HttpStatus.OK)
  async swapPlayer(@Body() dto: SwapPlayerDto): Promise<TeamResponseDto[]> {
    const result = await this.service.swapPlayerToTeam(
      dto.playerId,
      dto.fromTeamId,
      dto.toTeamId,
    );

    return [
      TeamResponseDto.fromEntity(result.fromTeam),
      TeamResponseDto.fromEntity(result.toTeam),
    ];
  }

  @Post('reassign-player')
  @ApiOperation({
    summary:
      'Reassign a player to a different team (removes from current team if any)',
  })
  @ApiResponse({
    status: 200,
    description: 'Player reassigned successfully',
    type: TeamResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Team or player not found' })
  @HttpCode(HttpStatus.OK)
  async reassignPlayer(
    @Body() dto: ReassignPlayerDto,
  ): Promise<TeamResponseDto> {
    const team = await this.service.reassignPlayer(dto.playerId, dto.newTeamId);
    return TeamResponseDto.fromEntity(team);
  }
}
