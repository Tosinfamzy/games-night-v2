import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateTeamDto {
  @ApiProperty({ example: 'Team A', description: 'Name of the team' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the game this team belongs to',
  })
  @IsUUID()
  @IsNotEmpty()
  gameId: string;
}
