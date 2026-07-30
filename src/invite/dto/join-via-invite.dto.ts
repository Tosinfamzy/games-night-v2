import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinViaInviteDto {
  @ApiProperty({
    required: false,
    description:
      'Optional display name. Defaults to the name on the invite so the guest ' +
      'is auto-checked-in against their RSVP.',
    example: 'Alice',
  })
  @IsString()
  @IsOptional()
  @MaxLength(80)
  name?: string;
}
