import { ApiProperty } from '@nestjs/swagger';
import { Game } from '../../game/game.entity';

export class GameResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Articulate' })
  name: string;

  @ApiProperty({ example: 'PENDING' })
  status: string;

  @ApiProperty({ example: 1 })
  currentRound: number;

  @ApiProperty({ example: 3 })
  maxRounds: number;

  @ApiProperty({ example: 'team-uuid', nullable: true })
  currentTurnTeamId: string | null;

  @ApiProperty({ example: '2025-07-19T15:30:00.000Z', nullable: true })
  turnStartedAt: Date | null;

  @ApiProperty({ example: 120, nullable: true })
  turnTimeLimit: number | null;

  @ApiProperty({ example: 'session-uuid' })
  sessionId: string;

  @ApiProperty({ example: 'library-uuid' })
  gameLibraryId: string | null;

  @ApiProperty({
    example: 2,
    description: 'Minimum number of players required',
  })
  minPlayers: number;

  @ApiProperty({
    example: 10,
    description: 'Maximum number of players allowed',
  })
  maxPlayers: number;

  @ApiProperty({ example: 'A fun word-guessing game', nullable: true })
  description: string | null;

  @ApiProperty({ example: ['team-uuid-1'] })
  teamIds: string[];

  @ApiProperty({ example: ['score-uuid-1'] })
  scoreIds: string[];

  @ApiProperty({ example: '2025-07-19T15:29:57.094Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-07-19T15:35:12.094Z' })
  updatedAt: Date;

  static fromEntity(entity: Game): GameResponseDto {
    const dto = new GameResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.status = entity.status;
    dto.currentRound = entity.currentRound;
    dto.maxRounds = entity.maxRounds;
    dto.currentTurnTeamId = entity.currentTurnTeamId ?? null;
    dto.turnStartedAt = entity.turnStartedAt ?? null;
    dto.turnTimeLimit = entity.turnTimeLimit ?? null;
    dto.sessionId = entity.session?.id ?? null;
    dto.gameLibraryId = entity.gameLibrary?.id ?? null;
    dto.minPlayers = entity.gameLibrary?.minPlayers ?? 0;
    dto.maxPlayers = entity.gameLibrary?.maxPlayers ?? 0;
    dto.description = entity.gameLibrary?.description ?? null;
    dto.teamIds = entity.teams?.map((team) => team.id) ?? [];
    dto.scoreIds = entity.scores?.map((score) => score.id) ?? [];
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
