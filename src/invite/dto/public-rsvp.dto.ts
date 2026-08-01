import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { RsvpStatus } from '../enums/rsvp-status.enum';

/**
 * A guest self-RSVPing through the single shareable session link (no auth, no
 * pre-created invite). Name is required here because there is no host-set name
 * to fall back on.
 */
export class PublicRsvpDto {
  @ApiProperty({ example: 'Ada Lovelace', description: 'Guest name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiProperty({
    enum: [RsvpStatus.GOING, RsvpStatus.MAYBE, RsvpStatus.NOT_GOING],
    description: 'The guest response',
  })
  @IsEnum(RsvpStatus)
  status: RsvpStatus;

  @ApiProperty({
    example: 'ada@example.com',
    description:
      'Guest email — required on the open RSVP link so we can send reminders ' +
      '(also dedupes repeat RSVPs).',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 1,
    description: 'Additional guests the invitee brings',
    required: false,
    minimum: 0,
    maximum: 10,
  })
  @IsInt()
  @Min(0)
  @Max(10)
  @IsOptional()
  plusOnes?: number;

  @ApiProperty({
    type: [String],
    required: false,
    description:
      'Names of the plus-ones, in order. Its length sets the plus-one count; ' +
      'an entry may be blank when a +1 is added without a name.',
    example: ['Jake', 'Priya'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  plusOneNames?: string[];

  @ApiProperty({ description: 'Optional note', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(280)
  note?: string;
}
