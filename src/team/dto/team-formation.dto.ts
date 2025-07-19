import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export enum TeamFormationStrategy {
  AUTOMATIC = 'automatic',
  MANUAL = 'manual',
  BALANCED = 'balanced',
  RANDOM = 'random',
}

export class CreateTeamsDto {
  @ApiProperty({
    example: 'automatic',
    description: 'Strategy for team formation',
    enum: TeamFormationStrategy,
  })
  @IsEnum(TeamFormationStrategy)
  strategy: TeamFormationStrategy;

  @ApiProperty({
    example: 2,
    description: 'Number of teams to create',
  })
  @IsNumber()
  @Min(2)
  @Max(8)
  teamCount: number;

  @ApiProperty({
    example: ['Team Red', 'Team Blue'],
    description: 'Custom team names (optional)',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teamNames?: string[];

  @ApiProperty({
    example: ['#FF5733', '#3366FF'],
    description: 'Team colors (optional)',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teamColors?: string[];
}

export class AssignPlayersDto {
  @ApiProperty({
    example: { 'team-1-id': ['player-1-id', 'player-2-id'] },
    description: 'Manual team assignments',
  })
  teamAssignments: Record<string, string[]>;
}
