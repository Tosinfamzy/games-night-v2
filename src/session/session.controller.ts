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
import { Session } from './session.entity';

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
  ): Promise<{ session: Session; message: string }> {
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
}
