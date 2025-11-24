import { ApiProperty } from '@nestjs/swagger';
import { GameStatus } from '../../game/enums/game-status.enum';
import { SessionStatus } from '../../session/enums/session-status.enum';

export class DashboardPlayerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  avatarUrl?: string;

  @ApiProperty()
  isOnline: boolean;

  @ApiProperty()
  teamId?: string;

  @ApiProperty()
  teamName?: string;
}

export class DashboardGameDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: GameStatus })
  status: GameStatus;

  @ApiProperty()
  currentRound: number;

  @ApiProperty()
  maxRounds: number;

  @ApiProperty()
  teamsCount: number;

  @ApiProperty({ required: false })
  currentTurnTeamId?: string;

  @ApiProperty({ required: false })
  currentTurnTeamName?: string;

  @ApiProperty({ required: false })
  turnStartedAt?: Date;

  @ApiProperty({ required: false })
  turnTimeLimit?: number;

  @ApiProperty({ required: false })
  winnerId?: string;

  @ApiProperty()
  createdAt: Date;
}

export class DashboardSessionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: SessionStatus })
  status: SessionStatus;

  @ApiProperty({ required: false })
  location?: string;

  @ApiProperty()
  scheduledFor: Date;

  @ApiProperty()
  playersCount: number;

  @ApiProperty({ type: [DashboardPlayerDto] })
  players: DashboardPlayerDto[];

  @ApiProperty({ type: [DashboardGameDto] })
  games: DashboardGameDto[];

  @ApiProperty()
  gamesInProgress: number;

  @ApiProperty()
  gamesCompleted: number;
}

export class DashboardStatsDto {
  @ApiProperty()
  totalSessions: number;

  @ApiProperty()
  activeSessions: number;

  @ApiProperty()
  totalPlayers: number;

  @ApiProperty()
  onlinePlayers: number;

  @ApiProperty()
  totalGames: number;

  @ApiProperty()
  gamesInProgress: number;

  @ApiProperty()
  gamesCompleted: number;
}

export class GamesMasterDashboardDto {
  @ApiProperty()
  gamesMasterId: string;

  @ApiProperty()
  gamesMasterName: string;

  @ApiProperty({ type: DashboardStatsDto })
  stats: DashboardStatsDto;

  @ApiProperty({ type: [DashboardSessionDto] })
  sessions: DashboardSessionDto[];

  @ApiProperty()
  lastUpdated: Date;
}
