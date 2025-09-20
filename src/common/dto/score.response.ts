import { ApiProperty } from '@nestjs/swagger';
import { Score } from '../../score/score.entity';

export class ScoreResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 5 })
  points: number;

  @ApiProperty({ example: false })
  isBonus: boolean;

  @ApiProperty({ example: 1 })
  roundNumber: number;

  @ApiProperty({ example: 'game-uuid' })
  gameId: string;

  @ApiProperty({ example: 'team-uuid', nullable: true })
  teamId: string | null;

  @ApiProperty({ example: 'player-uuid', nullable: true })
  playerId: string | null;

  @ApiProperty({ example: '2025-07-19T15:29:57.094Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-07-19T15:31:57.094Z' })
  updatedAt: Date;

  static fromEntity(entity: Score): ScoreResponseDto {
    const dto = new ScoreResponseDto();
    dto.id = entity.id;
    dto.points = entity.points;
    dto.isBonus = entity.isBonus;
    dto.roundNumber = entity.roundNumber;
    dto.gameId = entity.game?.id ?? null;
    dto.teamId = entity.team?.id ?? null;
    dto.playerId = entity.player?.id ?? null;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
