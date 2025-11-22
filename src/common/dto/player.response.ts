import { ApiProperty } from '@nestjs/swagger';
import { Player } from '../../player/player.entity';

export class PlayerResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Player 1' })
  name: string;

  @ApiProperty({ example: 'playing' })
  status: string;

  @ApiProperty({ example: '2025-07-19T16:30:46.512Z', nullable: true })
  lastConnectedAt: Date | null;

  @ApiProperty({ example: 'session-uuid' })
  sessionId: string;

  @ApiProperty({ example: ['team-uuid-1', 'team-uuid-2'] })
  teamIds: string[];

  @ApiProperty({
    example: ['score-uuid-1'],
    description: 'Scores recorded for the player',
  })
  scoreIds: string[];

  @ApiProperty({ example: '2025-07-19T16:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-07-19T16:10:00.000Z' })
  updatedAt: Date;

  static fromEntity(entity: Player): PlayerResponseDto {
    const dto = new PlayerResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.status = entity.status;
    dto.lastConnectedAt = entity.lastConnectedAt ?? null;
    dto.sessionId = entity.session?.id ?? null;
    dto.teamIds = entity.teams?.map((team) => team.id) ?? [];
    dto.scoreIds = entity.scores?.map((score) => score.id) ?? [];
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
