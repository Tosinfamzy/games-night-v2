import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, IsUUID } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    example: 'Hello everyone!',
    description: 'Message content',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 1000)
  content: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Session ID where the message is sent',
  })
  @IsUUID()
  sessionId: string;

  @ApiProperty({
    example: '660e8400-e29b-41d4-a716-446655440001',
    description: 'Player ID who is sending the message',
  })
  @IsUUID()
  playerId: string;
}
