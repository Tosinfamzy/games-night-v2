import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitGameScoreDto {
  @ApiProperty({ description: 'Team ID' })
  @IsUUID()
  teamId: string;

  @ApiProperty({ description: 'Score value', minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  score: number;

  @ApiProperty({
    description: 'Round number',
    required: false,
    default: 1,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  roundNumber?: number;
}
