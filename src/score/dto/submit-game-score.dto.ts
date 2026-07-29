import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitGameScoreDto {
  @ApiProperty({ description: 'Team ID' })
  @IsUUID()
  teamId: string;

  @ApiProperty({
    description:
      'Score value. May be negative to subtract points (e.g. penalty rounds).',
  })
  @IsNumber()
  @Type(() => Number)
  score: number;

  @ApiProperty({
    description:
      'Deprecated/ignored: the score is always recorded against the game’s ' +
      'current server-side round. Accepted for backward compatibility only.',
    required: false,
    default: 1,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  roundNumber?: number;
}
