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
import { Game } from './game.entity';

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
}
