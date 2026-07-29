import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateScoreDto {
  @ApiProperty({ description: 'Game ID' })
  @IsUUID()
  gameId: string;

  @ApiProperty({
    description: 'Points to award (may be negative to subtract points)',
  })
  @IsNumber()
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
