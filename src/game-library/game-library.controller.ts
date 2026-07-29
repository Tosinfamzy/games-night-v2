import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { GameLibraryService } from './game-library.service';
import { GameLibraryResponseDto } from '../common/dto/game-library.response';

/**
 * The game library is a single shared catalog across all games masters, seeded
 * server-side (see GameLibraryService.onModuleInit). It is intentionally
 * READ-ONLY over the API: there is no per-tenant ownership, so exposing
 * create/update/activate/deactivate/delete would let any authenticated GM mutate
 * or remove entries every other host depends on. Catalog changes are made via
 * seeding / migrations, not HTTP.
 */
@ApiTags('Game Library')
@Controller('game-library')
export class GameLibraryController {
  constructor(private readonly gameLibraryService: GameLibraryService) {}

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
    type: [GameLibraryResponseDto],
  })
  async findAll(
    @Query('includeInactive') includeInactive?: string,
    @Query('category') category?: string,
    @Query('playerCount') playerCount?: string,
  ) {
    if (category) {
      return this.gameLibraryService
        .findByCategory(category)
        .then((games) =>
          games.map((game) => GameLibraryResponseDto.fromEntity(game)),
        );
    }

    if (playerCount) {
      const count = parseInt(playerCount, 10);
      if (!isNaN(count)) {
        return this.gameLibraryService
          .findByPlayerCount(count)
          .then((games) =>
            games.map((game) => GameLibraryResponseDto.fromEntity(game)),
          );
      }
    }

    if (includeInactive === 'true') {
      return this.gameLibraryService
        .findAllIncludingInactive()
        .then((games) =>
          games.map((game) => GameLibraryResponseDto.fromEntity(game)),
        );
    }

    return this.gameLibraryService
      .findAll()
      .then((games) =>
        games.map((game) => GameLibraryResponseDto.fromEntity(game)),
      );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a game by ID' })
  @ApiResponse({
    status: 200,
    description: 'Game found',
    type: GameLibraryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Game not found',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameLibraryService
      .findOne(id)
      .then((game) => GameLibraryResponseDto.fromEntity(game));
  }
}
