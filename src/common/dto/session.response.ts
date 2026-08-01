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

  @ApiProperty({
    description: 'Custom map link for the location (e.g. a Google Maps pin).',
    example: 'https://maps.app.goo.gl/VSRPyxwhdKgNagAG7',
    nullable: true,
  })
  locationUrl?: string | null;

  @ApiProperty({
    description:
      'Host-authored invite message (share text + public RSVP greeting).',
    example: "You're invited! Bring snacks and your A-game 🎲",
    nullable: true,
  })
  inviteMessage?: string | null;

  @ApiProperty({
    description:
      "Host info shown to guests once they've joined (WiFi, house rules, etc.).",
    example: 'WiFi: GamesNight / pw: rolldice20 🎲',
    nullable: true,
  })
  hostMessage?: string | null;

  @ApiProperty({ type: () => GamesMasterSummaryDto, nullable: true })
  host: GamesMasterSummaryDto | null;

  @ApiProperty({
    description: 'Token for the single shareable RSVP link (host-facing)',
    example: 'uuid',
  })
  publicRsvpToken: string;

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

  @ApiProperty({
    example: ['player-uuid-1'],
    description: 'Associated player IDs',
  })
  playerIds: string[];

  // `includeHostSecrets` gates the host-only join levers: the `joinCode` (anyone
  // with it can join the session) and the shareable RSVP token (grants the
  // private guest list / self-RSVP page). It defaults to true for the host-
  // authenticated routes; the public reads (GET /:id for a non-host, join-code
  // lookup, join/rejoin responses) pass false so a caller holding only a session
  // id can't harvest them.
  static fromEntity(
    entity: Session,
    includeHostSecrets = true,
  ): SessionResponseDto {
    const dto = new SessionResponseDto();
    Object.assign(dto, SessionSummaryDto.fromEntity(entity));
    dto.description = entity.description ?? null;
    dto.location = entity.location ?? null;
    dto.locationUrl = entity.locationUrl ?? null;
    dto.inviteMessage = entity.inviteMessage ?? null;
    dto.hostMessage = entity.hostMessage ?? null;
    dto.host = GamesMasterSummaryDto.fromEntity(entity.host);
    if (includeHostSecrets) {
      dto.publicRsvpToken = entity.publicRsvpToken;
    } else {
      // Omit the join code from the serialized payload for non-host callers.
      delete (dto as { joinCode?: string }).joinCode;
    }
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

  @ApiProperty({
    description: 'JWT token for player authentication (valid for 24 hours)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  playerToken: string;

  static fromEntities(params: {
    session: Session;
    playerId: string;
    playerName: string;
    message: string;
    playerToken: string;
  }): SessionJoinResponseDto {
    const dto = new SessionJoinResponseDto();
    // A joining player is not the host — don't hand them the host-only join code
    // or shareable RSVP token in the join/rejoin payload.
    dto.session = SessionResponseDto.fromEntity(params.session, false);
    dto.playerId = params.playerId;
    dto.playerName = params.playerName;
    dto.message = params.message;
    dto.playerToken = params.playerToken;
    return dto;
  }
}
