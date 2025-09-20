import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Patch,
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
import { JoinSessionDto } from './dto/join-session.dto';
import { UpdatePlayerStatusDto } from './dto/update-player-status.dto';
import { Player } from './player.entity';
import { PlayerResponseDto } from '../common/dto/player.response';

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
    type: PlayerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input.',
  })
  create(@Body() dto: CreatePlayerDto): Promise<PlayerResponseDto> {
    return this.service
      .create(dto)
      .then((player) =>
        this.service.findOne(player.id, ['session', 'teams', 'scores']),
      )
      .then((player) => PlayerResponseDto.fromEntity(player));
  }

  @Get()
  @ApiOperation({ summary: 'Get all players' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all players.',
    type: [PlayerResponseDto],
  })
  findAll(): Promise<PlayerResponseDto[]> {
    return this.service
      .findAll(['session', 'teams', 'scores'])
      .then((players) =>
        players.map((player) => PlayerResponseDto.fromEntity(player)),
      );
  }

  @Get('session/:sessionId')
  @ApiOperation({ summary: 'Get all players in a session' })
  @ApiParam({ name: 'sessionId', description: 'ID of the session' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of players in the session.',
    type: [PlayerResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found.',
  })
  findBySession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<PlayerResponseDto[]> {
    return this.service
      .findBySession(sessionId)
      .then((players) =>
        players.map((player) => PlayerResponseDto.fromEntity(player)),
      );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a player by ID' })
  @ApiParam({ name: 'id', description: 'ID of the player' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The player record.',
    type: PlayerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Player not found.',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PlayerResponseDto> {
    return this.service
      .findOne(id, ['session', 'teams', 'scores'])
      .then((player) => PlayerResponseDto.fromEntity(player));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a player' })
  @ApiParam({ name: 'id', description: 'ID of the player' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The player has been successfully updated.',
    type: PlayerResponseDto,
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
  ): Promise<PlayerResponseDto> {
    return this.service
      .update(id, dto)
      .then((player) =>
        this.service.findOne(player.id, ['session', 'teams', 'scores']),
      )
      .then((player) => PlayerResponseDto.fromEntity(player));
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

  @Post('join')
  @ApiOperation({ summary: 'Join a session using join code' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Player successfully joined the session.',
    type: PlayerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid join code or session not joinable.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Player name already taken in session.',
  })
  joinSession(@Body() dto: JoinSessionDto): Promise<PlayerResponseDto> {
    return this.service
      .joinSession(dto)
      .then((player) =>
        this.service.findOne(player.id, ['session', 'teams', 'scores']),
      )
      .then((player) => PlayerResponseDto.fromEntity(player));
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update player status' })
  @ApiParam({ name: 'id', description: 'ID of the player' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Player status successfully updated.',
    type: PlayerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Player not found.',
  })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlayerStatusDto,
  ): Promise<PlayerResponseDto> {
    return this.service
      .updatePlayerStatus(id, dto)
      .then(() =>
        this.service.findOne(id, ['session', 'teams', 'scores']),
      )
      .then((player) => PlayerResponseDto.fromEntity(player));
  }

  @Patch(':id/ready')
  @ApiOperation({ summary: 'Mark player as ready' })
  @ApiParam({ name: 'id', description: 'ID of the player' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Player marked as ready.',
    type: PlayerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Player not found.',
  })
  setReady(@Param('id', ParseUUIDPipe) id: string): Promise<PlayerResponseDto> {
    return this.service
      .setPlayerReady(id)
      .then(() =>
        this.service.findOne(id, ['session', 'teams', 'scores']),
      )
      .then((player) => PlayerResponseDto.fromEntity(player));
  }

  @Patch(':id/not-ready')
  @ApiOperation({ summary: 'Mark player as not ready' })
  @ApiParam({ name: 'id', description: 'ID of the player' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Player marked as not ready.',
    type: PlayerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Player not found.',
  })
  setNotReady(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlayerResponseDto> {
    return this.service
      .setPlayerNotReady(id)
      .then(() =>
        this.service.findOne(id, ['session', 'teams', 'scores']),
      )
      .then((player) => PlayerResponseDto.fromEntity(player));
  }

  @Get('session/:sessionId/stats')
  @ApiOperation({ summary: 'Get player statistics for a session' })
  @ApiParam({ name: 'sessionId', description: 'ID of the session' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Player statistics for the session.',
  })
  getSessionStats(@Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.service.getSessionPlayerStats(sessionId);
  }

  @Delete(':id/remove')
  @ApiOperation({ summary: 'Remove player from session' })
  @ApiParam({ name: 'id', description: 'ID of the player' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Player successfully removed from session.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot remove player from active session.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Player not found.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  removeFromSession(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.removeFromSession(id);
  }
}
