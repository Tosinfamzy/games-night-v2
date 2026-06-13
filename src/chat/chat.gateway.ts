import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { BaseGateway } from '../common/gateways/base.gateway';
import { WS_CORS_CONFIG } from '../common/config/cors.config';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageHistoryQueryDto } from './dto/message-history-query.dto';
import { PlayerService } from '../player/player.service';
import { WsPlayerAuthGuard } from '../auth/guards/ws-player-auth.guard';
import { AppSocket } from '../common/types/socket.types';
import { getErrorMessage, getErrorName } from '../common/utils/error.util';

/**
 * WebSocket Gateway for real-time chat functionality
 * Protected by WsPlayerAuthGuard - all connections require valid player token
 */
@WebSocketGateway({
  namespace: 'chat',
  cors: WS_CORS_CONFIG,
})
@UseGuards(WsPlayerAuthGuard)
export class ChatGateway extends BaseGateway {
  @WebSocketServer()
  declare server: Server;

  protected logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly playerService: PlayerService,
  ) {
    super();
  }

  /**
   * Handle client connection
   * Player is already authenticated by WsPlayerAuthGuard
   */
  handleConnection(client: AppSocket): void {
    void super.handleConnection(client);

    try {
      // Extract authenticated player data from socket (set by WsPlayerAuthGuard)
      const playerData = client.data.player;

      if (!playerData) {
        this.logger.error(
          `Chat connection without authenticated player data: ${client.id}`,
        );
        client.disconnect();
        return;
      }

      const { playerId, sessionId, playerName } = playerData;

      this.logger.log(
        `Player ${playerName} (${playerId}) connected to chat for session ${sessionId}`,
      );

      // Auto-join the player to their session's chat room
      const room = `chat:session:${sessionId}`;
      this.joinRoom(client, room);
    } catch (error) {
      this.logger.error(
        `Failed to handle chat connection: ${getErrorMessage(error)}`,
      );
      client.disconnect();
    }
  }

  /**
   * Handle send-message event
   */
  @SubscribeMessage('send-message')
  async handleSendMessage(
    @MessageBody() dto: SendMessageDto,
    @ConnectedSocket() client: AppSocket,
  ): Promise<void> {
    try {
      // Save message to database
      const message = await this.chatService.saveMessage(dto);

      // Broadcast message to all clients in the session room
      const room = `chat:session:${dto.sessionId}`;
      this.emitToRoom(room, 'chat:message-sent', {
        message,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `Message sent by ${message.playerName} in session ${dto.sessionId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send message: ${getErrorMessage(error)}`);

      // Emit error to the sender
      client.emit('chat:error', {
        error: getErrorMessage(error),
        code: getErrorName(error),
      });
    }
  }

  /**
   * Handle load-history event
   */
  @SubscribeMessage('load-history')
  async handleLoadHistory(
    @MessageBody() query: MessageHistoryQueryDto,
    @ConnectedSocket() client: AppSocket,
  ): Promise<void> {
    try {
      const result = await this.chatService.getMessageHistory(query);

      // Send history to the requesting client only
      client.emit('chat:history-loaded', {
        messages: result.messages,
        hasMore: result.hasMore,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `Loaded ${result.messages.length} messages for session ${query.sessionId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to load history: ${getErrorMessage(error)}`);

      client.emit('chat:error', {
        error: getErrorMessage(error),
        code: getErrorName(error),
      });
    }
  }

  /**
   * Handle join-chat event (explicit join for a session)
   * Validates that player belongs to the session
   */
  @SubscribeMessage('join-chat')
  handleJoinChat(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: AppSocket,
  ): { status: string; sessionId: string; error?: string } {
    // Validate player belongs to this session
    const playerData = client.data.player;

    if (!playerData) {
      this.logger.warn(`Unauthenticated join-chat attempt: ${client.id}`);
      return {
        status: 'error',
        sessionId: data.sessionId,
        error: 'Unauthorized',
      };
    }

    if (playerData.sessionId !== data.sessionId) {
      this.logger.warn(
        `Player ${playerData.playerId} attempted to join chat for session ${data.sessionId} but belongs to ${playerData.sessionId}`,
      );
      return {
        status: 'error',
        sessionId: data.sessionId,
        error: 'Cannot join chat for session you do not belong to',
      };
    }

    const room = `chat:session:${data.sessionId}`;
    this.joinRoom(client, room);

    this.logger.log(
      `Player ${playerData.playerName} explicitly joined chat room for session ${data.sessionId}`,
    );

    return {
      status: 'joined',
      sessionId: data.sessionId,
    };
  }

  /**
   * Handle leave-chat event
   */
  @SubscribeMessage('leave-chat')
  handleLeaveChat(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: AppSocket,
  ): { status: string; sessionId: string } {
    const playerData = client.data.player;
    const room = `chat:session:${data.sessionId}`;
    this.leaveRoom(client, room);

    this.logger.log(
      `Player ${playerData?.playerName || 'unknown'} left chat room for session ${data.sessionId}`,
    );

    return {
      status: 'left',
      sessionId: data.sessionId,
    };
  }
}
