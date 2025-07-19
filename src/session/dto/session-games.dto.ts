import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsArray, IsOptional } from 'class-validator';

export class AddGamesToSessionDto {
  @ApiProperty({
    description: 'Array of game library IDs to add to the session',
    example: ['uuid1', 'uuid2'],
    type: [String],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  gameLibraryIds: string[];
}

export class RemoveGameFromSessionDto {
  @ApiProperty({
    description: 'Game ID to remove from the session',
    example: 'uuid',
  })
  @IsUUID()
  gameId: string;
}

export class UpdateSessionGamesDto {
  @ApiProperty({
    description:
      'Array of game library IDs for the session (replaces existing)',
    example: ['uuid1', 'uuid2'],
    type: [String],
    required: false,
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  gameLibraryIds?: string[];
}
