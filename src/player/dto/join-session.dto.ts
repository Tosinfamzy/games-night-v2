import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class JoinSessionDto {
  @ApiProperty({
    example: 'Alice',
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
    example: 'ABC123',
    description: 'Session join code (6 characters)',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Join code must be exactly 6 characters' })
  @Matches(/^[A-Z0-9]{6}$/, {
    message: 'Join code must be 6 uppercase letters and numbers',
  })
  joinCode: string;
}
