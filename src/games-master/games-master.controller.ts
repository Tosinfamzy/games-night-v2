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
import { GamesMasterService } from './games-master.service';
import { CreateGamesMasterDto } from './dto/create-games-master.dto';
import { UpdateGamesMasterDto } from './dto/update-games-master.dto';
import { GamesMasterResponseDto } from '../common/dto/games-master.response';
import { GamesMasterDashboardDto } from './dto/dashboard.dto';

@ApiTags('games-master')
@Controller('games-master')
export class GamesMasterController {
  constructor(private readonly service: GamesMasterService) {}

  @Post()
  @ApiOperation({ summary: 'Create a games master' })
  @ApiResponse({
    status: 201,
    description: 'Games master created successfully',
    type: GamesMasterResponseDto,
  })
  create(@Body() dto: CreateGamesMasterDto): Promise<GamesMasterResponseDto> {
    return this.service
      .create(dto)
      .then((master) => GamesMasterResponseDto.fromEntity(master));
  }

  @Get()
  @ApiOperation({ summary: 'Get all games masters' })
  @ApiResponse({
    status: 200,
    description: 'List of all games masters',
    type: [GamesMasterResponseDto],
  })
  findAll(): Promise<GamesMasterResponseDto[]> {
    return this.service
      .findAll(['sessions'])
      .then((masters) =>
        masters.map((master) => GamesMasterResponseDto.fromEntity(master)),
      );
  }

  @Get('by-name/:name')
  @ApiOperation({ summary: 'Get games masters by name (for code retrieval)' })
  @ApiParam({ name: 'name', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Games masters found with the given name',
    type: [GamesMasterResponseDto],
  })
  async findByName(@Param('name') name: string): Promise<GamesMasterResponseDto[]> {
    const masters = await this.service.findByName(name);
    return masters.map((master) => GamesMasterResponseDto.fromEntity(master));
  }

  @Get('by-code/:code')
  @ApiOperation({ summary: 'Get a games master by host code' })
  @ApiParam({ name: 'code', type: 'string', description: '6-character host code' })
  @ApiResponse({
    status: 200,
    description: 'Games master found',
    type: GamesMasterResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Games master not found with this code' })
  async findByCode(@Param('code') code: string): Promise<GamesMasterResponseDto> {
    const master = await this.service.findByCode(code.toUpperCase());
    return GamesMasterResponseDto.fromEntity(master);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a games master by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Games master found',
    type: GamesMasterResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Games master not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GamesMasterResponseDto> {
    const master = await this.service.findOne(id, ['sessions']);
    return GamesMasterResponseDto.fromEntity(master);
  }

  @Get(':id/active-sessions')
  @ApiOperation({ summary: 'Get a games master with their active sessions' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Games master with active sessions',
    type: GamesMasterResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Games master not found' })
  async findWithActiveSessions(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GamesMasterResponseDto> {
    const master = await this.service.findWithActiveSessions(id);
    return GamesMasterResponseDto.fromEntity(master);
  }

  @Get(':id/dashboard')
  @ApiOperation({
    summary: 'Get comprehensive dashboard for games master control panel',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Games master dashboard with all sessions, games, and stats',
    type: GamesMasterDashboardDto,
  })
  @ApiNotFoundResponse({ description: 'Games master not found' })
  async getDashboard(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GamesMasterDashboardDto> {
    return this.service.getDashboard(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a games master' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Games master updated',
    type: GamesMasterResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Games master not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGamesMasterDto,
  ): Promise<GamesMasterResponseDto> {
    return this.service
      .update(id, dto)
      .then((master) => GamesMasterResponseDto.fromEntity(master));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a games master' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Games master deleted successfully',
  })
  @ApiNotFoundResponse({ description: 'Games master not found' })
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.delete(id);
  }
}
