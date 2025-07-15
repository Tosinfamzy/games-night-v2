import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
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
import { PlayerService } from './player.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { Player } from './player.entity';

@ApiTags('players')
@ApiBearerAuth()
@Controller('players')
export class PlayerController {
  constructor(private readonly service: PlayerService) {}

  @Post()
  @ApiOperation({ summary: 'Create a player' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The player has been successfully created.',
    type: Player,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input.',
  })
  create(@Body() dto: CreatePlayerDto): Promise<Player> {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all players' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all players.',
    type: [Player],
  })
  findAll(): Promise<Player[]> {
    return this.service.findAll();
  }

  @Get('session/:sessionId')
  @ApiOperation({ summary: 'Get all players in a session' })
  @ApiParam({ name: 'sessionId', description: 'ID of the session' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of players in the session.',
    type: [Player],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found.',
  })
  findBySession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<Player[]> {
    return this.service.findBySession(sessionId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a player by ID' })
  @ApiParam({ name: 'id', description: 'ID of the player' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The player record.',
    type: Player,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Player not found.',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Player> {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a player' })
  @ApiParam({ name: 'id', description: 'ID of the player' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The player has been successfully updated.',
    type: Player,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Player not found.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlayerDto,
  ): Promise<Player> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a player' })
  @ApiParam({ name: 'id', description: 'ID of the player' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The player has been successfully deleted.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Player not found.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.delete(id);
  }
}
