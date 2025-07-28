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
import { GameService } from './game.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { StartGameDto } from './dto/start-game.dto';
import { StartGameWithTeamsDto } from './dto/start-game-with-teams.dto';
import { NextTurnDto } from './dto/next-turn.dto';
import { Game } from './game.entity';
import { GameStatus } from './enums/game-status.enum';

@ApiTags('games')
@ApiBearerAuth()
@Controller('games')
export class GameController {
  constructor(private readonly service: GameService) {}

  @Post()
  @ApiOperation({ summary: 'Create a game' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The game has been successfully created.',
    type: Game,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input.',
  })
  create(@Body() dto: CreateGameDto): Promise<Game> {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all games' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all games.',
    type: [Game],
  })
  findAll(): Promise<Game[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a game by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The game has been found.',
    type: Game,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Game> {
    return this.service.findOne(id);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start a game' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The game has been started.',
    type: Game,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid game state or team configuration.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game or teams not found.',
  })
  startGame(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartGameDto,
  ): Promise<Game> {
    return this.service.startGame(id, dto);
  }

  @Post(':id/start-first-round')
  @ApiOperation({ summary: 'Start the first round of the game' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'First round has been started.',
    type: Game,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid game state.',
  })
  startFirstRound(@Param('id', ParseUUIDPipe) id: string): Promise<Game> {
    return this.service.startFirstRound(id);
  }

  @Post(':id/next-round')
  @ApiOperation({ summary: 'Start the next round' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Next round has been started.',
    type: Game,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid game state or maximum rounds reached.',
  })
  startNextRound(@Param('id', ParseUUIDPipe) id: string): Promise<Game> {
    return this.service.startNextRound(id);
  }

  @Post(':id/end-round')
  @ApiOperation({ summary: 'End the current round' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current round has been ended.',
    type: Game,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid game state.',
  })
  endCurrentRound(@Param('id', ParseUUIDPipe) id: string): Promise<Game> {
    return this.service.endCurrentRound(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a game' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The game has been cancelled.',
    type: Game,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid game state.',
  })
  cancelGame(@Param('id', ParseUUIDPipe) id: string): Promise<Game> {
    return this.service.cancelGame(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a game' })
  @ApiParam({ name: 'id', description: 'ID of the game' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The game has been successfully updated.',
    type: Game,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGameDto,
  ): Promise<Game> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a game' })
  @ApiParam({ name: 'id', description: 'ID of the game' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The game has been successfully deleted.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.delete(id);
  }

  // ============ ENHANCED GAME FLOW ENDPOINTS ============

  @Post(':id/start-with-teams')
  @ApiOperation({ summary: 'Start a game with automatic team formation' })
  @ApiParam({ name: 'id', description: 'ID of the game' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Game started successfully with teams formed.',
    type: Game,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or game cannot be started.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  startWithTeams(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartGameWithTeamsDto,
  ): Promise<Game> {
    return this.service.startGameWithTeams(id, dto);
  }

  @Get(':id/readiness')
  @ApiOperation({ summary: 'Check if a game is ready to start' })
  @ApiParam({ name: 'id', description: 'ID of the game' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Game readiness status.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  checkReadiness(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.checkGameReadiness(id);
  }

  @Post(':id/next-turn')
  @ApiOperation({ summary: "Move to the next team's turn" })
  @ApiParam({ name: 'id', description: 'ID of the game' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Turn changed successfully.',
    type: Game,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Game is not in progress or invalid turn change.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  nextTurn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NextTurnDto,
  ): Promise<Game> {
    return this.service.nextTurn(id, dto);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause the game' })
  @ApiParam({ name: 'id', description: 'ID of the game' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Game paused successfully.',
    type: Game,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Game cannot be paused.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  pauseGame(@Param('id', ParseUUIDPipe) id: string): Promise<Game> {
    return this.service.pauseGame(id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused game' })
  @ApiParam({ name: 'id', description: 'ID of the game' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Game resumed successfully.',
    type: Game,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Game is not paused.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  resumeGame(@Param('id', ParseUUIDPipe) id: string): Promise<Game> {
    return this.service.resumeGame(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get comprehensive game statistics' })
  @ApiParam({ name: 'id', description: 'ID of the game' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Game statistics retrieved successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  getGameStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getGameStats(id);
  }

  @Post(':id/force-start')
  @ApiOperation({ summary: 'Force start a game (bypass team requirements)' })
  @ApiParam({ name: 'id', description: 'ID of the game' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Game force started successfully.',
    type: Game,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Game cannot be started.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  forceStartGame(@Param('id', ParseUUIDPipe) id: string): Promise<Game> {
    return this.service.forceStartGame(id);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a game' })
  @ApiParam({ name: 'id', description: 'Game ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Game completed successfully.',
    type: Game,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Game cannot be completed.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  completeGame(@Param('id', ParseUUIDPipe) id: string): Promise<Game> {
    return this.service.completeGame(id);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update game status' })
  @ApiParam({ name: 'id', description: 'Game ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Game status updated successfully.',
    type: Game,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid status transition.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  updateGameStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: GameStatus },
  ): Promise<Game> {
    return this.service.updateGameStatus(id, dto.status);
  }
}
