import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { HistoryService } from './history.service';
import { GameResult } from './game-result.entity';
import { QueryHistoryDto } from './dto/query-history.dto';
import { PlayerStatsDto } from './dto/player-stats.dto';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { CurrentGm } from '../auth/decorators/current-gm.decorator';
import { GamesMaster } from '../games-master/games-master.entity';

// History exposes game records, per-player stats and leaderboards. Everything is
// scoped to the signed-in games master's own sessions — a host sees their own
// nights, never every tenant's games/players. (No response cache: the
// URL-keyed CacheInterceptor would serve one host's history to another now that
// results differ per caller.)
@ApiTags('history')
@ApiBearerAuth()
@Controller('history')
@UseGuards(ClerkAuthGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get('games')
  @ApiOperation({ summary: 'Get game history for your sessions' })
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
  async getGameHistory(
    @CurrentGm() gm: GamesMaster,
    @Query() queryDto: QueryHistoryDto,
  ): Promise<GameResult[]> {
    return this.historyService.getGameHistory(gm.id, queryDto);
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
  async getGameResultById(
    @CurrentGm() gm: GamesMaster,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GameResult> {
    return this.historyService.getGameResultById(gm.id, id);
  }

  @Get('players/:playerId/stats')
  @ApiOperation({ summary: 'Get a player’s stats within your sessions' })
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
  async getPlayerStats(
    @CurrentGm() gm: GamesMaster,
    @Param('playerId', ParseUUIDPipe) playerId: string,
  ): Promise<PlayerStatsDto> {
    return this.historyService.getPlayerStats(gm.id, playerId);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Top players across your sessions (by win rate)' })
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
  async getLeaderboard(
    @CurrentGm() gm: GamesMaster,
    @Query('limit') limit?: number,
  ): Promise<PlayerStatsDto[]> {
    return this.historyService.getLeaderboard(gm.id, limit || 10);
  }
}
