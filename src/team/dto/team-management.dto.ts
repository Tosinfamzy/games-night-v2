import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for swapping a player between teams
 */
export class SwapPlayerDto {
  @ApiProperty({
    description: 'ID of the player to swap',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  playerId: string;

  @ApiProperty({
    description: 'ID of the source team',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  @IsNotEmpty()
  fromTeamId: string;

  @ApiProperty({
    description: 'ID of the destination team',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsUUID()
  @IsNotEmpty()
  toTeamId: string;
}

/**
 * DTO for reassigning a player to a team
 */
export class ReassignPlayerDto {
  @ApiProperty({
    description: 'ID of the player to reassign',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  playerId: string;

  @ApiProperty({
    description: 'ID of the new team',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  @IsNotEmpty()
  newTeamId: string;
}
