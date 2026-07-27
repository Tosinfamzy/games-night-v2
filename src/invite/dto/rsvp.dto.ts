import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { RsvpStatus } from '../enums/rsvp-status.enum';

/** A guest's response, submitted via their invite token (public, no auth). */
export class RsvpDto {
  @ApiProperty({
    enum: [RsvpStatus.GOING, RsvpStatus.MAYBE, RsvpStatus.NOT_GOING],
    description: 'The guest response',
  })
  @IsEnum(RsvpStatus)
  status: RsvpStatus;

  @ApiProperty({
    description: 'Name, for open-link RSVPs where it was not preset',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(80)
  name?: string;

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

  @ApiProperty({ description: 'Optional note', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(280)
  note?: string;
}
