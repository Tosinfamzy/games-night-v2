import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import {
  CreateTeamsDto,
  AssignPlayersDto,
  TeamFormationStrategy,
} from './dto/team-formation.dto';
import { Team } from './team.entity';

@ApiTags('teams')
@Controller('teams')
export class TeamController {
  constructor(private readonly service: TeamService) {}

  @Post()
  @ApiOperation({ summary: 'Create a team' })
  @ApiResponse({
    status: 201,
    description: 'Team created successfully',
    type: Team,
  })
  @ApiNotFoundResponse({ description: 'Game not found' })
  create(@Body() dto: CreateTeamDto): Promise<Team> {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all teams' })
  @ApiResponse({
    status: 200,
    description: 'List of all teams',
    type: [Team],
  })
  findAll(): Promise<Team[]> {
    return this.service.findAll(['game', 'players']);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a team by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Team found', type: Team })
  @ApiNotFoundResponse({ description: 'Team not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Team> {
    return this.service.findOne(id, ['game', 'players']);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a team' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Team updated', type: Team })
  @ApiNotFoundResponse({ description: 'Team not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
  ): Promise<Team> {
    return this.service.update(id, dto);
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
    type: [Team],
  })
  @ApiNotFoundResponse({ description: 'Game not found' })
  async findByGame(
    @Param('gameId', ParseUUIDPipe) gameId: string,
  ): Promise<Team[]> {
    return this.service.findByGame(gameId);
  }

  @Post('game/:gameId/create-teams')
  @ApiOperation({ summary: 'Create teams for a game with automatic formation' })
  @ApiParam({ name: 'gameId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Teams created successfully',
    type: [Team],
  })
  @ApiNotFoundResponse({ description: 'Game not found' })
  async createTeamsForGame(
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Body() dto: CreateTeamsDto,
  ): Promise<Team[]> {
    return this.service.createTeamsForGame(gameId, dto);
  }

  @Put('game/:gameId/assign-players')
  @ApiOperation({ summary: 'Manually assign players to teams' })
  @ApiParam({ name: 'gameId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Players assigned successfully',
    type: [Team],
  })
  @ApiNotFoundResponse({ description: 'Game or teams not found' })
  async manualAssignPlayers(
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Body() dto: AssignPlayersDto,
  ): Promise<Team[]> {
    return this.service.manualAssignPlayers(gameId, dto);
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
    type: [Team],
  })
  @ApiNotFoundResponse({ description: 'Game or teams not found' })
  async rebalanceTeams(
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Body() body: { strategy: 'automatic' | 'balanced' | 'random' | 'manual' },
  ): Promise<Team[]> {
    const strategy =
      TeamFormationStrategy[
        body.strategy.toUpperCase() as keyof typeof TeamFormationStrategy
      ] || TeamFormationStrategy.AUTOMATIC;
    return this.service.rebalanceTeams(gameId, strategy);
  }
}
