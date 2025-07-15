import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateScoreDto {
  @ApiProperty({ description: 'Game ID' })
  @IsUUID()
  gameId: string;

  @ApiProperty({ description: 'Points to award', minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  points: number;

  @ApiProperty({
    description: 'Whether these are bonus points',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isBonus?: boolean;

  @ApiProperty({ description: 'Player ID (optional)' })
  @IsUUID()
  @IsOptional()
  playerId?: string;

  @ApiProperty({ description: 'Team ID (optional)' })
  @IsUUID()
  @IsOptional()
  teamId?: string;
}
