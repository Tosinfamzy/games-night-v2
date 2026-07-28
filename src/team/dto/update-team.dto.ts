import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';

export class UpdateTeamDto {
  @ApiProperty({ example: 'Team A', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  gameId?: string;

  @ApiProperty({ example: '#3B82F6', required: false })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ example: 1, required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  position?: number;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
