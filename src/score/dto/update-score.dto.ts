import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateScoreDto {
  @ApiProperty({
    description: 'Points to award (may be negative to subtract points)',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  points?: number;

  @ApiProperty({
    description: 'Whether these are bonus points',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isBonus?: boolean;
}
