import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsUUID, IsNotEmpty } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({
    description: 'Date of the session',
    example: '2025-07-14T19:00:00Z',
  })
  @IsDate()
  @IsNotEmpty()
  date: Date;

  @ApiProperty({
    description: 'ID of the hosting games master',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  hostId: string;
}
