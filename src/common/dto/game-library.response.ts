import { ApiProperty } from '@nestjs/swagger';
import { GameLibrary } from '../../game-library/game-library.entity';

export class GameLibraryResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Articulate' })
  name: string;

  @ApiProperty({ example: 'Word-based party game' })
  description: string;

  @ApiProperty({ example: 4 })
  minPlayers: number;

  @ApiProperty({ example: 12 })
  maxPlayers: number;

  @ApiProperty({ example: 30 })
  estimatedDuration: number;

  @ApiProperty({ example: 'Easy' })
  difficulty: string;

  @ApiProperty({ example: ['Party', 'Word Game'] })
  categories: string[];

  @ApiProperty({ example: 'Cards, Timer', nullable: true })
  equipment?: string | null;

  @ApiProperty({ example: 'Teams take turns describing words', nullable: true })
  rules?: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2025-07-19T14:47:39.863Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-07-19T14:47:39.863Z' })
  updatedAt: Date;

  static fromEntity(entity: GameLibrary): GameLibraryResponseDto {
    const dto = new GameLibraryResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.minPlayers = entity.minPlayers;
    dto.maxPlayers = entity.maxPlayers;
    dto.estimatedDuration = entity.estimatedDuration;
    dto.difficulty = entity.difficulty;
    dto.categories = entity.categories ?? [];
    dto.equipment = entity.equipment ?? null;
    dto.rules = entity.rules ?? null;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
