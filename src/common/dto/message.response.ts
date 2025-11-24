import { ApiProperty } from '@nestjs/swagger';
import { Message } from '../../chat/chat.entity';
import { MessageType } from '../../chat/enums/message-type.enum';

export class MessageResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Message ID',
  })
  id: string;

  @ApiProperty({
    example: 'Hello everyone!',
    description: 'Message content',
  })
  content: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Session ID',
  })
  sessionId: string;

  @ApiProperty({
    example: '660e8400-e29b-41d4-a716-446655440001',
    description: 'Player ID',
  })
  playerId: string;

  @ApiProperty({
    example: 'Alice',
    description: 'Player name (denormalized for convenience)',
  })
  playerName: string;

  @ApiProperty({
    example: MessageType.TEXT,
    enum: MessageType,
    description: 'Message type',
  })
  type: string;

  @ApiProperty({
    example: false,
    description: 'Whether the message has been edited',
  })
  isEdited: boolean;

  @ApiProperty({
    example: '2025-07-19T10:30:00Z',
    description: 'When the message was created',
  })
  createdAt: Date;

  static fromEntity(message: Message): MessageResponseDto {
    const dto = new MessageResponseDto();
    dto.id = message.id;
    dto.content = message.content;
    dto.sessionId = message.session.id;
    dto.playerId = message.player.id;
    dto.playerName = message.player.name;
    dto.type = message.type;
    dto.isEdited = message.isEdited;
    dto.createdAt = message.createdAt;
    return dto;
  }
}
