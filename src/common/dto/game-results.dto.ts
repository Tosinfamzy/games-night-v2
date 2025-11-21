import { ApiProperty } from '@nestjs/swagger';
import { TeamStandingDto } from './team-standing.dto';

/**
 * DTO representing complete game results with rankings and winner
 */
export class GameResultsDto {
  @ApiProperty({
    example: 'game-uuid-123',
    description: 'Game ID',
  })
  gameId: string;

  @ApiProperty({
    example: 'Trivia Challenge',
    description: 'Game name',
  })
  gameName: string;

  @ApiProperty({
    example: 'COMPLETED',
    description: 'Game status',
    enum: [
      'PENDING',
      'READY_TO_START',
      'IN_PROGRESS',
      'ROUND_IN_PROGRESS',
      'ROUND_ENDED',
      'WAITING_FOR_TEAMS',
      'PAUSED',
      'COMPLETED',
      'CANCELLED',
    ],
  })
  status: string;

  @ApiProperty({
    example: 'team-uuid-123',
    description: 'ID of the winning team',
    nullable: true,
  })
  winnerId: string | null;

  @ApiProperty({
    example: 'The Trivia Masters',
    description: 'Name of the winning team',
    nullable: true,
  })
  winnerName: string | null;

  @ApiProperty({
    example: 450,
    description: 'Winning score',
    nullable: true,
  })
  winningScore: number | null;

  @ApiProperty({
    example: '2025-01-15T14:30:00Z',
    description: 'When the game was completed',
    nullable: true,
  })
  completedAt: string | null;

  @ApiProperty({
    type: [TeamStandingDto],
    description: 'All teams ranked by score',
  })
  standings: TeamStandingDto[];

  @ApiProperty({
    example: 3,
    description: 'Number of rounds completed',
  })
  roundsCompleted: number;

  @ApiProperty({
    example: false,
    description: 'Whether there was a tie for first place',
  })
  isTied: boolean;
}
