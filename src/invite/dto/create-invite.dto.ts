import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  MaxLength,
} from 'class-validator';

/** Games master adds a named guest to a session's guest list. */
export class CreateInviteDto {
  @ApiProperty({ example: 'Ada Lovelace', description: 'Guest name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiProperty({
    example: 'ada@example.com',
    description: 'Guest email (optional, for future delivery/reminders)',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;
}
