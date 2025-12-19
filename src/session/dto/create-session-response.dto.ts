import { ApiProperty } from '@nestjs/swagger';
import { Session } from '../session.entity';
import { Player } from '../../player/player.entity';

export class CreateSessionResponseDto {
  @ApiProperty({ description: 'The created session' })
  session: Session;

  @ApiProperty({ description: 'The auto-created player for the GM' })
  gmPlayer: Player;

  @ApiProperty({ description: 'Success message' })
  message: string;

  @ApiProperty({
    description: 'JWT token for GM player authentication (valid for 24 hours)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  playerToken: string;
}
