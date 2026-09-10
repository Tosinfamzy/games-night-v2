import { ApiProperty } from '@nestjs/swagger';
import { GameFormat } from '../../game-library/enums/game-format.enum';

/** A suggested game with its planning defaults and computed timing. */
export class PlanGameSuggestionDto {
  @ApiProperty({ format: 'uuid' })
  gameLibraryId: string;

  @ApiProperty({ example: 'Heavy Drinkers' })
  name: string;

  @ApiProperty({ enum: GameFormat })
  format: GameFormat;

  @ApiProperty({ example: 'All teams at once' })
  formatLabel: string;

  @ApiProperty({ example: 3 })
  recommendedRounds: number;

  @ApiProperty({ example: 3, nullable: true })
  playersPerRound: number | null;

  @ApiProperty({ example: 3, nullable: true })
  minTeams: number | null;

  @ApiProperty({ example: 15, description: 'Library estimate (minutes)' })
  estimatedDuration: number;

  @ApiProperty({
    example: 15,
    description: 'Minutes for the recommended rounds',
  })
  segmentMinutes: number;

  @ApiProperty({ example: 'Placement — 1st 3, 2nd 2, 3rd 1' })
  scoringLabel: string;
}

export class PlanTeamSuggestionDto {
  @ApiProperty({ example: 3 })
  teamCount: number;

  @ApiProperty({ type: [Number], example: [7, 7, 6] })
  sizes: number[];
}

export class PlanTimelineItemDto {
  @ApiProperty({ format: 'uuid' })
  gameLibraryId: string;

  @ApiProperty({ example: 'Musical Cups' })
  name: string;

  @ApiProperty({ example: 0, description: 'Minutes from the start' })
  startOffsetMinutes: number;

  @ApiProperty({ example: 10 })
  minutes: number;
}

export class PlanTimelineDto {
  @ApiProperty({ type: [PlanTimelineItemDto] })
  items: PlanTimelineItemDto[];

  @ApiProperty({ example: 135 })
  totalMinutes: number;
}

export class NightPlanSuggestionDto {
  @ApiProperty({ example: 20 })
  playerCount: number;

  @ApiProperty({ type: PlanTeamSuggestionDto })
  teamSuggestion: PlanTeamSuggestionDto;

  @ApiProperty({ type: [PlanGameSuggestionDto] })
  games: PlanGameSuggestionDto[];

  @ApiProperty({ type: PlanTimelineDto })
  timeline: PlanTimelineDto;

  @ApiProperty({
    type: [String],
    description: 'Non-blocking advisories (headcount, team fit)',
  })
  warnings: string[];
}
