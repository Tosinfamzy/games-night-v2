import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HostGuard } from '../auth/guards/host.guard';
import { SessionMemberGuard } from '../auth/guards/session-member.guard';
import { HostOf } from '../auth/decorators/host-of.decorator';
import { SessionResponseDto } from '../common/dto/session.response';
import { NightPlannerService } from './night-planner.service';
import { SuggestPlanDto } from './dto/suggest-plan.dto';
import { ApplyNightPlanDto } from './dto/apply-night-plan.dto';
import { NightPlanSuggestionDto } from './dto/night-plan-suggestion.dto';

/**
 * Host-only planning endpoints for a session's "night". Mounted under the
 * session so ownership is resolved from the `:id` param by @HostOf('session').
 */
@ApiTags('night-planner')
@ApiBearerAuth()
@UseGuards(HostGuard, SessionMemberGuard)
@Controller('sessions/:id/plan')
export class NightPlannerController {
  constructor(private readonly planner: NightPlannerService) {}

  @Get('suggestions')
  @HostOf('session')
  @ApiOperation({
    summary: 'Suggest a tailored plan (rounds, timing, team split) for games',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Session ID' })
  @ApiResponse({ status: HttpStatus.OK, type: NightPlanSuggestionDto })
  suggest(
    @Param('id', ParseUUIDPipe) _id: string,
    @Query() dto: SuggestPlanDto,
  ): Promise<NightPlanSuggestionDto> {
    return this.planner.suggestPlan(dto);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @HostOf('session')
  @ApiOperation({
    summary: 'Apply a planned line-up (games in order + teams) to the session',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Session ID' })
  @ApiResponse({ status: HttpStatus.OK, type: SessionResponseDto })
  async apply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyNightPlanDto,
  ): Promise<SessionResponseDto> {
    const session = await this.planner.applyPlan(id, dto);
    return SessionResponseDto.fromEntity(session);
  }
}
