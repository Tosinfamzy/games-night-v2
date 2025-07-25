import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsArray,
  IsOptional,
} from 'class-validator';

export class CreateTeamForSessionDto {
  @ApiProperty({
    example: 'Team Alpha',
    description: 'Name of the team',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description:
      'ID of the game this team belongs to (optional for session-level teams)',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  gameId?: string;

  @ApiProperty({
    example: '#FF6B6B',
    description: 'Team color (optional)',
    required: false,
  })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({
    example: ['player-id-1', 'player-id-2'],
    description: 'Array of player IDs to assign to this team',
    required: false,
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  playerIds?: string[];
}

export class AssignPlayersToTeamDto {
  @ApiProperty({
    example: ['player-id-1', 'player-id-2'],
    description: 'Array of player IDs to assign to the team',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsNotEmpty()
  playerIds: string[];
}
