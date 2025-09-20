import { ApiProperty } from '@nestjs/swagger';
import { Session } from '../../session/session.entity';
import { GamesMasterSummaryDto } from './games-master.response';

export class SessionSummaryDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Friday Night Session' })
  name: string;

  @ApiProperty({ example: 'SCHEDULED' })
  status: string;

  @ApiProperty({ example: '127779' })
  joinCode: string;

  @ApiProperty({ example: '2025-07-24T20:00:00.000Z' })
  date: Date;

  static fromEntity(entity: Session): SessionSummaryDto {
    const dto = new SessionSummaryDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.status = entity.status;
    dto.joinCode = entity.joinCode;
    dto.date = entity.date;
    return dto;
  }
}

export class SessionResponseDto extends SessionSummaryDto {
  @ApiProperty({ example: 'Weekly board game meetup', nullable: true })
  description?: string | null;

  @ApiProperty({ example: 'Community Hall', nullable: true })
  location?: string | null;

  @ApiProperty({ type: () => GamesMasterSummaryDto, nullable: true })
  host: GamesMasterSummaryDto | null;

  @ApiProperty({ example: 3 })
  gamesCount: number;

  @ApiProperty({ example: 4 })
  teamsCount: number;

  @ApiProperty({ example: 12 })
  playersCount: number;

  @ApiProperty({ example: '2025-07-01T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-07-02T09:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: ['game-uuid-1'], description: 'Associated game IDs' })
  gameIds: string[];

  @ApiProperty({ example: ['team-uuid-1'], description: 'Associated team IDs' })
  teamIds: string[];

  @ApiProperty({ example: ['player-uuid-1'], description: 'Associated player IDs' })
  playerIds: string[];

  static fromEntity(entity: Session): SessionResponseDto {
    const dto = new SessionResponseDto();
    Object.assign(dto, SessionSummaryDto.fromEntity(entity));
    dto.description = entity.description ?? null;
    dto.location = entity.location ?? null;
    dto.host = GamesMasterSummaryDto.fromEntity(entity.host);
    dto.gamesCount = entity.games?.length ?? 0;
    dto.teamsCount = entity.teams?.length ?? 0;
    dto.playersCount = entity.players?.length ?? 0;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.gameIds = entity.games?.map((game) => game.id) ?? [];
    dto.teamIds = entity.teams?.map((team) => team.id) ?? [];
    dto.playerIds = entity.players?.map((player) => player.id) ?? [];
    return dto;
  }
}

export class SessionJoinResponseDto {
  @ApiProperty({ type: () => SessionResponseDto })
  session: SessionResponseDto;

  @ApiProperty({ example: 'Successfully joined session.' })
  message: string;

  @ApiProperty({ description: 'Newly created player record ID' })
  playerId: string;

  @ApiProperty({ example: 'Player name' })
  playerName: string;

  static fromEntities(params: {
    session: Session;
    playerId: string;
    playerName: string;
    message: string;
  }): SessionJoinResponseDto {
    const dto = new SessionJoinResponseDto();
    dto.session = SessionResponseDto.fromEntity(params.session);
    dto.playerId = params.playerId;
    dto.playerName = params.playerName;
    dto.message = params.message;
    return dto;
  }
}
