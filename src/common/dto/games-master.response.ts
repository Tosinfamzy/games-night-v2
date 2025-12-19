import { ApiProperty } from '@nestjs/swagger';
import { GamesMaster } from '../../games-master/games-master.entity';

export class GamesMasterSummaryDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Demo Host' })
  name: string;

  @ApiProperty({
    example: 'ABC123',
    description: '6-character unique host code',
  })
  hostCode: string;

  @ApiProperty({ example: 3 })
  sessionCount: number;

  static fromEntity(
    entity: GamesMaster | null | undefined,
  ): GamesMasterSummaryDto | null {
    if (!entity) {
      return null;
    }

    const dto = new GamesMasterSummaryDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.hostCode = entity.hostCode;
    dto.sessionCount = entity.sessions?.length ?? 0;
    return dto;
  }
}

export class GamesMasterResponseDto extends GamesMasterSummaryDto {
  @ApiProperty({ example: '2025-01-01T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-01-02T10:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: ['uuid-1', 'uuid-2'] })
  sessionIds: string[];

  static fromEntity(entity: GamesMaster): GamesMasterResponseDto {
    const dto = new GamesMasterResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.hostCode = entity.hostCode;
    dto.sessionCount = entity.sessions?.length ?? 0;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.sessionIds = entity.sessions?.map((session) => session.id) ?? [];
    return dto;
  }
}
