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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ScoreService } from './score.service';
import { CreateScoreDto } from './dto/create-score.dto';
import { UpdateScoreDto } from './dto/update-score.dto';
import { SubmitGameScoreDto } from './dto/submit-game-score.dto';
import { Score } from './score.entity';
import { TeamScore } from './interfaces/team-score.interface';
import { ScoreResponseDto } from '../common/dto/score.response';
import { HostGuard } from '../auth/guards/host.guard';
import { SessionMemberGuard } from '../auth/guards/session-member.guard';
import { HostOf } from '../auth/decorators/host-of.decorator';
import { SessionMember } from '../auth/decorators/session-member.decorator';

@ApiTags('scores')
@ApiBearerAuth()
@UseGuards(HostGuard, SessionMemberGuard)
@Controller('scores')
export class ScoreController {
  constructor(private readonly service: ScoreService) {}

  @Post()
  @HostOf('game', 'gameId')
  @ApiOperation({ summary: 'Create a score record' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The score has been successfully created.',
    type: ScoreResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input.',
  })
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute
  async create(@Body() dto: CreateScoreDto): Promise<ScoreResponseDto> {
    return this.service
      .create(dto)
      .then((score) => this.service.findOne(score.id))
      .then((score) => ScoreResponseDto.fromEntity(score));
  }

  @Post('games/:gameId/submit')
  @HostOf('game', 'gameId')
  @ApiOperation({ summary: 'Submit scores for a game' })
  @ApiParam({ name: 'gameId', description: 'ID of the game' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The scores have been successfully submitted.',
    type: ScoreResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found.',
  })
  // Live host scoring is bursty (several teams x rounds); keep a high ceiling
  // to guard against runaway loops without blocking real play.
  @Throttle({ default: { limit: 120, ttl: 60000 } }) // 120 requests per minute
  @HttpCode(HttpStatus.CREATED)
  async submitGameScore(
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Body() dto: SubmitGameScoreDto,
  ): Promise<ScoreResponseDto> {
    return this.service
      .submitGameScore(gameId, dto)
      .then((score) => this.service.findOne(score.id))
      .then((score) => ScoreResponseDto.fromEntity(score));
  }

  @Get('games/:gameId')
  @SessionMember('game', 'gameId')
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
  async getGameScores(
    @Param('gameId', ParseUUIDPipe) gameId: string,
  ): Promise<TeamScore[]> {
    return this.service.getGameScores(gameId);
  }

  @Get(':id')
  @SessionMember('score', 'id')
  @ApiOperation({ summary: 'Get a score by ID' })
  @ApiParam({ name: 'id', description: 'ID of the score record' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The score record.',
    type: ScoreResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Score not found.',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ScoreResponseDto> {
    return this.service
      .findOne(id)
      .then((score) => ScoreResponseDto.fromEntity(score));
  }

  @Put(':id')
  @HostOf('score')
  @ApiOperation({ summary: 'Update a score record' })
  @ApiParam({ name: 'id', description: 'ID of the score record' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The score has been successfully updated.',
    type: ScoreResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Score not found.',
  })
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScoreDto,
  ): Promise<ScoreResponseDto> {
    const updatedScore = await this.service.update(id, dto);
    return ScoreResponseDto.fromEntity(updatedScore);
  }

  @Delete(':id')
  @HostOf('score')
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
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.delete(id);
  }
}
