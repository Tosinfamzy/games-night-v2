import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class NextTurnDto {
  @ApiProperty({
    description:
      'ID of the team whose turn it should be next (optional - will auto-rotate if not provided)',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  nextTeamId?: string;
}
