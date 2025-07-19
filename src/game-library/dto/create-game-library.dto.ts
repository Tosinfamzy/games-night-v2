import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  IsEnum,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class CreateGameLibraryDto {
  @ApiProperty({
    description: 'Name of the game',
    example: 'Articulate',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description of the game',
    example:
      'A fun word-guessing game where teams compete to describe words without saying them directly.',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Minimum number of players required',
    example: 4,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  minPlayers: number;

  @ApiProperty({
    description: 'Maximum number of players supported',
    example: 12,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  maxPlayers: number;

  @ApiProperty({
    description: 'Estimated duration in minutes',
    example: 30,
    minimum: 1,
    maximum: 600,
  })
  @IsNumber()
  @Min(1)
  @Max(600)
  estimatedDuration: number;

  @ApiProperty({
    description: 'Difficulty level',
    enum: ['Easy', 'Medium', 'Hard'],
    example: 'Easy',
  })
  @IsEnum(['Easy', 'Medium', 'Hard'])
  difficulty: 'Easy' | 'Medium' | 'Hard';

  @ApiProperty({
    description: 'Categories this game belongs to',
    example: ['Word Game', 'Team Game', 'Party Game'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  categories: string[];

  @ApiProperty({
    description: 'Required equipment for the game',
    example: 'Cards, Timer',
    required: false,
  })
  @IsString()
  @IsOptional()
  equipment?: string;

  @ApiProperty({
    description: 'Brief rules summary',
    example:
      'Teams take turns describing words while teammates guess. No rhyming, sounds-like, or direct translations allowed.',
    required: false,
  })
  @IsString()
  @IsOptional()
  rules?: string;

  @ApiProperty({
    description: 'Whether this game is currently available for selection',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
