import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsInt,
  Min,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ScoreMode } from '../enums/score-mode.enum';

export class CreateGameDto {
  @ApiProperty({ example: 'Chess', description: 'Name of the game' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'uuid',
    description: 'ID of the session this game belongs to',
  })
  @IsUUID()
  sessionId: string;

  @ApiProperty({
    example: 3,
    description: 'Maximum number of rounds',
    default: 1,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxRounds?: number;

  @ApiProperty({
    enum: ScoreMode,
    default: ScoreMode.TEAM,
    required: false,
    description:
      'Score by team (default) or by individual player. Individual mode lets a ' +
      '1-v-1 game skip building one-person teams.',
  })
  @IsEnum(ScoreMode)
  @IsOptional()
  scoreMode?: ScoreMode;
}
