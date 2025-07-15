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
import { GamesMaster } from './games-master.entity';

@ApiTags('games-master')
@Controller('games-master')
export class GamesMasterController {
  constructor(private readonly service: GamesMasterService) {}

  @Post()
  @ApiOperation({ summary: 'Create a games master' })
  @ApiResponse({
    status: 201,
    description: 'Games master created successfully',
    type: GamesMaster,
  })
  create(@Body() dto: CreateGamesMasterDto): Promise<GamesMaster> {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all games masters' })
  @ApiResponse({
    status: 200,
    description: 'List of all games masters',
    type: [GamesMaster],
  })
  findAll(): Promise<GamesMaster[]> {
    return this.service.findAll(['sessions']);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a games master by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Games master found',
    type: GamesMaster,
  })
  @ApiNotFoundResponse({ description: 'Games master not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<GamesMaster> {
    return this.service.findOne(id, ['sessions']);
  }

  @Get(':id/active-sessions')
  @ApiOperation({ summary: 'Get a games master with their active sessions' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Games master with active sessions',
    type: GamesMaster,
  })
  @ApiNotFoundResponse({ description: 'Games master not found' })
  async findWithActiveSessions(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GamesMaster> {
    return this.service.findWithActiveSessions(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a games master' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Games master updated',
    type: GamesMaster,
  })
  @ApiNotFoundResponse({ description: 'Games master not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGamesMasterDto,
  ): Promise<GamesMaster> {
    return this.service.update(id, dto);
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
