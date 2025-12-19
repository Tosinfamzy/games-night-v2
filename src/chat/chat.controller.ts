import { Controller, Get, Query, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { MessageHistoryQueryDto } from './dto/message-history-query.dto';
import { MessageResponseDto } from '../common/dto/message.response';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * Get message history for a session
   */
  @Get('sessions/:sessionId/messages')
  @ApiOperation({
    summary: 'Get message history for a session',
    description:
      'Retrieve paginated message history for a session with cursor-based pagination',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID to get messages for',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of messages to fetch (default: 50, max: 100)',
  })
  @ApiQuery({
    name: 'beforeMessageId',
    required: false,
    type: String,
    description:
      'Message ID to fetch messages before (for pagination/scrollback)',
  })
  @ApiResponse({
    status: 200,
    description: 'Message history retrieved successfully',
    type: [MessageResponseDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async getSessionMessages(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query() query: MessageHistoryQueryDto,
  ): Promise<{ messages: MessageResponseDto[]; hasMore: boolean }> {
    // Merge sessionId from param into query DTO
    query.sessionId = sessionId;
    return this.chatService.getMessageHistory(query);
  }
}
