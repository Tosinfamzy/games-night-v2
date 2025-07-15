import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateScoreDto {
  @ApiProperty({
    description: 'Points to award',
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @Min(0)
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
