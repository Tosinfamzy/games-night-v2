import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { GameLibraryService } from './game-library.service';
import { CreateGameLibraryDto } from './dto/create-game-library.dto';
import { UpdateGameLibraryDto } from './dto/update-game-library.dto';
import { GameLibrary } from './game-library.entity';

@ApiTags('Game Library')
@Controller('game-library')
export class GameLibraryController {
  constructor(private readonly gameLibraryService: GameLibraryService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new game in the library' })
  @ApiResponse({
    status: 201,
    description: 'Game successfully created',
    type: GameLibrary,
  })
  create(@Body() createGameLibraryDto: CreateGameLibraryDto) {
    return this.gameLibraryService.create(createGameLibraryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active games from the library' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Include inactive games in the results',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by category',
  })
  @ApiQuery({
    name: 'playerCount',
    required: false,
    description: 'Filter by player count',
  })
  @ApiResponse({
    status: 200,
    description: 'List of games',
    type: [GameLibrary],
  })
  async findAll(
    @Query('includeInactive') includeInactive?: string,
    @Query('category') category?: string,
    @Query('playerCount') playerCount?: string,
  ) {
    if (category) {
      return this.gameLibraryService.findByCategory(category);
    }

    if (playerCount) {
      const count = parseInt(playerCount, 10);
      if (!isNaN(count)) {
        return this.gameLibraryService.findByPlayerCount(count);
      }
    }

    if (includeInactive === 'true') {
      return this.gameLibraryService.findAllIncludingInactive();
    }

    return this.gameLibraryService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a game by ID' })
  @ApiResponse({
    status: 200,
    description: 'Game found',
    type: GameLibrary,
  })
  @ApiResponse({
    status: 404,
    description: 'Game not found',
  })
  findOne(@Param('id') id: string) {
    return this.gameLibraryService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a game' })
  @ApiResponse({
    status: 200,
    description: 'Game successfully updated',
    type: GameLibrary,
  })
  @ApiResponse({
    status: 404,
    description: 'Game not found',
  })
  update(
    @Param('id') id: string,
    @Body() updateGameLibraryDto: UpdateGameLibraryDto,
  ) {
    return this.gameLibraryService.update(id, updateGameLibraryDto);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a game (soft delete)' })
  @ApiResponse({
    status: 200,
    description: 'Game successfully deactivated',
    type: GameLibrary,
  })
  deactivate(@Param('id') id: string) {
    return this.gameLibraryService.deactivate(id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a game' })
  @ApiResponse({
    status: 200,
    description: 'Game successfully activated',
    type: GameLibrary,
  })
  activate(@Param('id') id: string) {
    return this.gameLibraryService.activate(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Permanently delete a game' })
  @ApiResponse({
    status: 200,
    description: 'Game successfully deleted',
  })
  @ApiResponse({
    status: 404,
    description: 'Game not found',
  })
  remove(@Param('id') id: string) {
    return this.gameLibraryService.remove(id);
  }
}
