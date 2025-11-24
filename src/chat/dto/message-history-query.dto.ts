import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class MessageHistoryQueryDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Session ID to fetch messages from',
  })
  @IsUUID()
  sessionId: string;

  @ApiProperty({
    example: 50,
    description: 'Maximum number of messages to return',
    required: false,
    minimum: 1,
    maximum: 100,
    default: 50,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 50;

  @ApiProperty({
    example: '660e8400-e29b-41d4-a716-446655440001',
    description: 'Return messages before this message ID (for pagination)',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  beforeMessageId?: string;
}
