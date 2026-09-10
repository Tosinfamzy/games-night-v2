import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ScoreMode } from '../../game/enums/score-mode.enum';
import { LIMITS } from '../../common/constants';

/** One game in the applied plan, in run-of-show order. */
export class ApplyPlanGameDto {
  @ApiProperty({ description: 'Library ID of the game', format: 'uuid' })
  @IsUUID()
  gameLibraryId: string;

  @ApiProperty({ example: 3, minimum: 1, description: 'Rounds to play' })
  @IsInt()
  @Min(1)
  maxRounds: number;

  @ApiProperty({
    enum: ScoreMode,
    required: false,
    default: ScoreMode.TEAM,
    description: 'How the game is scored (defaults to team)',
  })
  @IsOptional()
  @IsEnum(ScoreMode)
  scoreMode?: ScoreMode;

  @ApiProperty({ example: 0, minimum: 0, description: 'Run-of-show position' })
  @IsInt()
  @Min(0)
  orderIndex: number;
}

/** Team setup for the applied plan (empty teams; players assigned on the night). */
export class ApplyPlanTeamsDto {
  @ApiProperty({
    example: 3,
    minimum: LIMITS.MIN_TEAMS_PER_GAME,
    maximum: LIMITS.MAX_TEAMS_PER_GAME,
    description: 'Number of teams to create',
  })
  @IsInt()
  @Min(LIMITS.MIN_TEAMS_PER_GAME)
  @Max(LIMITS.MAX_TEAMS_PER_GAME)
  count: number;

  @ApiProperty({
    type: [String],
    required: false,
    description: 'Custom team names (defaults applied when omitted)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  names?: string[];

  @ApiProperty({
    type: [String],
    required: false,
    description: 'Custom team colours (defaults applied when omitted)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colors?: string[];
}

/**
 * Apply a planned night to a session: replaces the session's games and teams
 * with the chosen line-up (in order) and an empty set of teams. Only valid on
 * a SCHEDULED session.
 */
export class ApplyNightPlanDto {
  @ApiProperty({ type: [ApplyPlanGameDto], description: 'Games in order' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LIMITS.MAX_GAMES_PER_SESSION)
  @ValidateNested({ each: true })
  @Type(() => ApplyPlanGameDto)
  games: ApplyPlanGameDto[];

  @ApiProperty({ type: ApplyPlanTeamsDto, description: 'Team setup' })
  @ValidateNested()
  @Type(() => ApplyPlanTeamsDto)
  teams: ApplyPlanTeamsDto;
}
