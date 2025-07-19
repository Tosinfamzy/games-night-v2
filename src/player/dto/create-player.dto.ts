import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, Length, Matches } from 'class-validator';

export class CreatePlayerDto {
  @ApiProperty({
    example: 'Bob',
    description: 'Player name (3-20 characters, alphanumeric and spaces only)',
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 20, { message: 'Player name must be between 3 and 20 characters' })
  @Matches(/^[a-zA-Z0-9\s]+$/, {
    message: 'Player name can only contain letters, numbers, and spaces',
  })
  name: string;

  @ApiProperty({
    example: 'uuid',
    description: 'ID of the session this player belongs to',
  })
  @IsUUID()
  sessionId: string;
}
