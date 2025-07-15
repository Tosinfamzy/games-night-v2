import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreatePlayerDto {
  @ApiProperty({ example: 'Bob', description: 'Player name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'uuid',
    description: 'ID of the session this player belongs to',
  })
  @IsUUID()
  sessionId: string;
}
