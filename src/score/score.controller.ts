import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseInterceptors,
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
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Throttle } from '@nestjs/throttler';
import { ScoreService } from './score.service';
import { CreateScoreDto } from './dto/create-score.dto';
import { UpdateScoreDto } from './dto/update-score.dto';
import { SubmitGameScoreDto } from './dto/submit-game-score.dto';
import { Score } from './score.entity';
import { TeamScore } from './interfaces/team-score.interface';

@ApiTags('scores')
@ApiBearerAuth()
@Controller('scores')
@UseInterceptors(CacheInterceptor)
export class ScoreController {
  constructor(private readonly service: ScoreService) {}

  @Post()
  @ApiOperation({ summary: 'Create a score record' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The score has been successfully created.',
    type: Score,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input.',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async create(@Body() dto: CreateScoreDto): Promise<Score> {
    return this.service.create(dto);
  }

  @Post('games/:gameId/submit')
  @ApiOperation({ summary: 'Submit scores for a game' })
  @ApiParam({ name: 'gameId', description: 'ID of the game' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The scores have been successfully submitted.',
    type: Score,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @HttpCode(HttpStatus.CREATED)
  async submitGameScore(
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Body() dto: SubmitGameScoreDto,
  ): Promise<Score> {
    return this.service.submitGameScore(gameId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all score records' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all scores.',
    type: [Score],
  })
  @CacheTTL(30) // Cache for 30 seconds
  async findAll(): Promise<Score[]> {
    return this.service.findAll();
  }

  @Get('games/:gameId')
  @ApiOperation({ summary: 'Get all scores for a specific game' })
  @ApiParam({ name: 'gameId', description: 'ID of the game' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of scores for the game.',
    type: Score,
    isArray: true,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  @CacheTTL(30) // Cache for 30 seconds
  async getGameScores(
    @Param('gameId', ParseUUIDPipe) gameId: string,
  ): Promise<TeamScore[]> {
    return this.service.getGameScores(gameId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a score by ID' })
  @ApiParam({ name: 'id', description: 'ID of the score record' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The score record.',
    type: Score,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Score not found.',
  })
  @CacheTTL(60) // Cache for 1 minute
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Score> {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a score record' })
  @ApiParam({ name: 'id', description: 'ID of the score record' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The score has been successfully updated.',
    type: Score,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Score not found.',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScoreDto,
  ): Promise<Score> {
    const updatedScore = await this.service.update(id, dto);
    return updatedScore;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a score record' })
  @ApiParam({ name: 'id', description: 'ID of the score record' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The score has been successfully deleted.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Score not found.',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.delete(id);
  }

  @Post('games/:gameId/next-round')
  @ApiOperation({ summary: 'Progress to next round and get round summary' })
  @ApiParam({ name: 'gameId', description: 'Game ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Round progressed successfully with summary',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot progress round - invalid game state.',
  })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async progressToNextRound(@Param('gameId', ParseUUIDPipe) gameId: string) {
    return this.service.progressToNextRound(gameId);
  }

  @Get('games/:gameId/history')
  @ApiOperation({ summary: 'Get comprehensive score history for a game' })
  @ApiParam({ name: 'gameId', description: 'Game ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Score history with rounds and leaderboard',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  @CacheTTL(30) // Cache for 30 seconds
  async getScoreHistory(@Param('gameId', ParseUUIDPipe) gameId: string) {
    return this.service.getScoreHistory(gameId);
  }

  @Put(':id/adjust')
  @ApiOperation({ summary: 'Adjust a score with reason for auditing' })
  @ApiParam({ name: 'id', description: 'Score ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Score adjusted successfully',
    type: Score,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Score not found.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid adjustment or game completed.',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async adjustScore(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { points?: number; reason: string },
  ): Promise<Score> {
    return this.service.adjustScore(id, body);
  }
}
