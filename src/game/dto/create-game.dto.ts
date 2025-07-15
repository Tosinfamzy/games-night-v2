import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsInt,
  Min,
  IsOptional,
} from 'class-validator';

export class CreateGameDto {
  @ApiProperty({ example: 'Chess', description: 'Name of the game' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'uuid',
    description: 'ID of the session this game belongs to',
  })
  @IsUUID()
  sessionId: string;

  @ApiProperty({
    example: 3,
    description: 'Maximum number of rounds',
    default: 1,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxRounds?: number;
}
