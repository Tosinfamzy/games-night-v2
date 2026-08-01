import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Body for rejoining a session with a previously-issued player token. */
export class RejoinSessionDto {
  @ApiProperty({
    description: 'The player token issued when the player first joined',
  })
  @IsString()
  @IsNotEmpty()
  playerToken: string;
}
