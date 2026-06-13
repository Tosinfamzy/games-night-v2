import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { HistoryService } from './history.service';
import { GameResult } from './game-result.entity';
import { QueryHistoryDto } from './dto/query-history.dto';
import { PlayerStatsDto } from './dto/player-stats.dto';

@ApiTags('history')
@Controller('history')
@UseInterceptors(CacheInterceptor)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get('games')
  @ApiOperation({ summary: 'Get game history with optional filters' })
  @ApiQuery({
    name: 'sessionId',
    required: false,
    description: 'Filter by session ID',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of results to return',
    example: 10,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of results to skip',
    example: 0,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Game history retrieved successfully',
    type: [GameResult],
  })
  @CacheTTL(60000) // Cache for 60 seconds
  async getGameHistory(
    @Query() queryDto: QueryHistoryDto,
  ): Promise<GameResult[]> {
    return this.historyService.getGameHistory(queryDto);
  }

  @Get('games/:id')
  @ApiOperation({ summary: 'Get a specific game result by ID' })
  @ApiParam({ name: 'id', description: 'Game result ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Game result retrieved successfully',
    type: GameResult,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game result not found',
  })
  @CacheTTL(300000) // Cache for 5 minutes
  async getGameResultById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GameResult> {
    return this.historyService.getGameResultById(id);
  }

  @Get('players/:playerId/stats')
  @ApiOperation({ summary: 'Get statistics for a specific player' })
  @ApiParam({ name: 'playerId', description: 'Player ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Player statistics retrieved successfully',
    type: PlayerStatsDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Player not found',
  })
  @CacheTTL(120000) // Cache for 2 minutes
  async getPlayerStats(
    @Param('playerId', ParseUUIDPipe) playerId: string,
  ): Promise<PlayerStatsDto> {
    return this.historyService.getPlayerStats(playerId);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get leaderboard (top players by win rate)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of top players to return',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Leaderboard retrieved successfully',
    type: [PlayerStatsDto],
  })
  @CacheTTL(180000) // Cache for 3 minutes
  async getLeaderboard(
    @Query('limit') limit?: number,
  ): Promise<PlayerStatsDto[]> {
    return this.historyService.getLeaderboard(limit || 10);
  }
}
