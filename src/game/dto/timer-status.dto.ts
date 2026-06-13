import { ApiProperty } from '@nestjs/swagger';

export class TimerStatusDto {
  @ApiProperty({
    description: 'Game ID',
    example: 'game-uuid',
  })
  gameId: string;

  @ApiProperty({
    description: 'Team currently taking their turn',
    example: 'team-uuid',
    nullable: true,
  })
  currentTurnTeamId: string | null;

  @ApiProperty({
    description: 'Name of the team currently taking their turn',
    example: 'Red Team',
    nullable: true,
  })
  currentTurnTeamName: string | null;

  @ApiProperty({
    description: 'When the current turn started',
    example: '2025-07-19T15:30:00.000Z',
    nullable: true,
  })
  turnStartedAt: Date | null;

  @ApiProperty({
    description: 'Turn time limit in seconds',
    example: 120,
    nullable: true,
  })
  turnTimeLimit: number | null;

  @ApiProperty({
    description: 'Seconds elapsed since turn started',
    example: 45,
  })
  elapsedSeconds: number;

  @ApiProperty({
    description: 'Seconds remaining (null if no time limit)',
    example: 75,
    nullable: true,
  })
  remainingSeconds: number | null;

  @ApiProperty({
    description: 'Whether the timer has expired',
    example: false,
  })
  isExpired: boolean;

  @ApiProperty({
    description: 'Percentage of time used (0-100)',
    example: 37.5,
    nullable: true,
  })
  percentageUsed: number | null;
}
