import { ApiProperty } from '@nestjs/swagger';
import { TeamScore } from '../../score/interfaces/team-score.interface';

/**
 * DTO representing a team's standing in a game with ranking information
 */
export class TeamStandingDto implements TeamScore {
  @ApiProperty({
    example: 'team-uuid-123',
    description: 'Team ID',
  })
  teamId: string;

  @ApiProperty({
    example: 'The Trivia Masters',
    description: 'Team name (or player name when entrantType is "player")',
  })
  teamName: string;

  @ApiProperty({
    enum: ['team', 'player'],
    example: 'team',
    required: false,
    description:
      'Whether this standing is a team or an individual player. In individual ' +
      'mode, teamId/teamName hold the player id/name.',
  })
  entrantType?: 'team' | 'player';

  @ApiProperty({
    example: 1,
    description: 'Team rank/position (1 = winner)',
  })
  rank: number;

  @ApiProperty({
    example: 450,
    description: 'Total points scored',
  })
  totalPoints: number;

  @ApiProperty({
    example: 3,
    description: 'Number of bonus points earned',
  })
  bonusPointsCount: number;

  @ApiProperty({
    example: { 1: 100, 2: 150, 3: 200 },
    description: 'Points scored per round (round number -> points)',
  })
  roundPoints: Record<number, number>;

  @ApiProperty({
    example: false,
    description: 'Whether this team is tied with another team',
    required: false,
  })
  isTied?: boolean;
}
