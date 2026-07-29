import { ApiProperty } from '@nestjs/swagger';
import {
  IsDate,
  IsUUID,
  IsNotEmpty,
  IsString,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSessionDto {
  @ApiProperty({
    description: 'Name of the session',
    example: 'Friday Game Night',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description of the session',
    example: 'Weekly board game session',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Date of the session',
    example: '2025-07-14T19:00:00Z',
  })
  @Transform(({ value }: { value: string | number | Date }) => new Date(value))
  @IsDate()
  @IsNotEmpty()
  date: Date;

  @ApiProperty({
    description: 'Location of the session',
    example: 'Community Center',
    required: false,
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({
    description:
      'Host-authored invite message, used as the default share text for the ' +
      'RSVP link and shown on the public RSVP page. Send an empty string to clear it.',
    example: "You're invited! Bring snacks and your A-game 🎲",
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  inviteMessage?: string;

  @ApiProperty({
    description:
      'ID of the hosting games master. Optional when authenticated as a ' +
      'games master via Clerk (the host is then derived from the token); ' +
      'legacy clients still pass it explicitly.',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  gamesMasterId?: string;
}
