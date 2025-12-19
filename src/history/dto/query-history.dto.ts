import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryHistoryDto {
  @ApiProperty({
    example: 'uuid',
    description: 'Filter by session ID',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  sessionId?: string;

  @ApiProperty({
    example: 'uuid',
    description: 'Filter by player ID',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  playerId?: string;

  @ApiProperty({
    example: 10,
    description: 'Number of results to return',
    default: 10,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiProperty({
    example: 0,
    description: 'Number of results to skip (pagination)',
    default: 0,
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  offset?: number;
}
