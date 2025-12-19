import { ApiProperty } from '@nestjs/swagger';

export class PlayerStatsDto {
  @ApiProperty({
    example: 'uuid',
    description: 'Player ID',
  })
  playerId: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Player name',
  })
  playerName: string;

  @ApiProperty({
    example: 15,
    description: 'Total number of games played',
  })
  gamesPlayed: number;

  @ApiProperty({
    example: 8,
    description: 'Total number of games won',
  })
  gamesWon: number;

  @ApiProperty({
    example: 0.533,
    description: 'Win rate (0.0 to 1.0)',
  })
  winRate: number;

  @ApiProperty({
    example: 1250,
    description: 'Total score across all games',
  })
  totalScore: number;

  @ApiProperty({
    example: 83.33,
    description: 'Average score per game',
  })
  averageScore: number;

  @ApiProperty({
    example: 'Chess',
    description: 'Most frequently played game',
    required: false,
  })
  favoriteGame?: string;

  @ApiProperty({
    example: '2025-12-14T15:30:00Z',
    description: 'Timestamp of last game played',
    required: false,
  })
  lastPlayedAt?: string;
}
