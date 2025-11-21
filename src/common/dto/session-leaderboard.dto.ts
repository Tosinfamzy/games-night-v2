import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO representing a team's performance across all games in a session
 */
export class SessionTeamStandingDto {
  @ApiProperty({
    example: 'team-uuid-123',
    description: 'Team ID',
  })
  teamId: string;

  @ApiProperty({
    example: 'The Trivia Masters',
    description: 'Team name',
  })
  teamName: string;

  @ApiProperty({
    example: 1,
    description: 'Overall rank in session (1 = champion)',
  })
  rank: number;

  @ApiProperty({
    example: 1250,
    description: 'Total points across all games',
  })
  totalPoints: number;

  @ApiProperty({
    example: 3,
    description: 'Number of games won',
  })
  gamesWon: number;

  @ApiProperty({
    example: 5,
    description: 'Number of games played',
  })
  gamesPlayed: number;

  @ApiProperty({
    example: { 'game-uuid-1': 450, 'game-uuid-2': 380, 'game-uuid-3': 420 },
    description: 'Points scored per game (game ID -> points)',
  })
  gamePoints: Record<string, number>;

  @ApiProperty({
    example: 250.0,
    description: 'Average points per game',
  })
  averagePoints: number;
}

/**
 * DTO representing the complete leaderboard for a session
 */
export class SessionLeaderboardDto {
  @ApiProperty({
    example: 'session-uuid-123',
    description: 'Session ID',
  })
  sessionId: string;

  @ApiProperty({
    example: 'Game Night - January 2025',
    description: 'Session name',
  })
  sessionName: string;

  @ApiProperty({
    example: 'COMPLETED',
    description: 'Session status',
    enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  })
  status: string;

  @ApiProperty({
    example: 'team-uuid-123',
    description: 'ID of the session champion (overall winner)',
    nullable: true,
  })
  championId: string | null;

  @ApiProperty({
    example: 'The Trivia Masters',
    description: 'Name of the session champion',
    nullable: true,
  })
  championName: string | null;

  @ApiProperty({
    type: [SessionTeamStandingDto],
    description: 'All teams ranked by total session points',
  })
  standings: SessionTeamStandingDto[];

  @ApiProperty({
    example: 5,
    description: 'Number of games completed in the session',
  })
  gamesCompleted: number;

  @ApiProperty({
    example: 4,
    description: 'Number of teams that participated',
  })
  teamsCount: number;

  @ApiProperty({
    example: '2025-01-15T18:30:00Z',
    description: 'When the session was completed',
    nullable: true,
  })
  completedAt: string | null;
}
