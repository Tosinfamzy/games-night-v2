import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum } from 'class-validator';
import { PlayerStatus } from '../../player/player.entity';

/** Body for marking a player ready / not-ready. */
export class SetPlayerReadyDto {
  @ApiProperty({ description: 'Whether the player is ready to start' })
  @IsBoolean()
  ready: boolean;
}

/** Body for updating a player's status — constrained to the known states. */
export class UpdatePlayerStatusDto {
  @ApiProperty({
    enum: PlayerStatus,
    description: 'New player status',
  })
  @IsEnum(PlayerStatus)
  status: PlayerStatus;
}
