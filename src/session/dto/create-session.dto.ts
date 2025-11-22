import { ApiProperty } from '@nestjs/swagger';
import {
  IsDate,
  IsUUID,
  IsNotEmpty,
  IsString,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSessionDto {
  @ApiProperty({
    description: 'Name of the session',
    example: 'Friday Game Night',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description of the session',
    example: 'Weekly board game session',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Date of the session',
    example: '2025-07-14T19:00:00Z',
  })
  @Transform(({ value }: { value: string | number | Date }) => new Date(value))
  @IsDate()
  @IsNotEmpty()
  date: Date;

  @ApiProperty({
    description: 'Location of the session',
    example: 'Community Center',
    required: false,
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({
    description: 'ID of the hosting games master',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  gamesMasterId: string;
}
