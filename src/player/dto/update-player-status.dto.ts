import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PlayerStatus } from '../player.entity';

export class UpdatePlayerStatusDto {
  @ApiProperty({
    example: 'ready',
    description: 'New status for the player',
    enum: PlayerStatus,
  })
  @IsEnum(PlayerStatus, {
    message: 'Status must be one of: joined, ready, playing, disconnected',
  })
  status: PlayerStatus;

  @ApiProperty({
    example: '2025-07-19T10:30:00Z',
    description: 'When the player last connected',
    required: false,
  })
  @IsOptional()
  lastConnectedAt?: Date;
}
