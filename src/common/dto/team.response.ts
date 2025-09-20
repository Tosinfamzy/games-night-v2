import { ApiProperty } from '@nestjs/swagger';
import { Team } from '../../team/team.entity';

export class TeamResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Team Alpha' })
  name: string;

  @ApiProperty({ example: '#FF5733', nullable: true })
  color?: string | null;

  @ApiProperty({ example: 1 })
  position: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 'session-uuid' })
  sessionId: string | null;

  @ApiProperty({ example: 'game-uuid', nullable: true })
  gameId: string | null;

  @ApiProperty({ example: ['player-uuid-1'] })
  playerIds: string[];

  @ApiProperty({ example: ['score-uuid-1'] })
  scoreIds: string[];

  @ApiProperty({ example: '2025-07-19T15:35:15.883Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-07-19T15:40:15.883Z' })
  updatedAt: Date;

  static fromEntity(entity: Team): TeamResponseDto {
    const dto = new TeamResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.color = entity.color ?? null;
    dto.position = entity.position;
    dto.isActive = entity.isActive;
    dto.sessionId = entity.session?.id ?? null;
    dto.gameId = entity.game?.id ?? null;
    dto.playerIds = entity.players?.map((player) => player.id) ?? [];
    dto.scoreIds = entity.scores?.map((score) => score.id) ?? [];
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
