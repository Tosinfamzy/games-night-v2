import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { BaseGateway } from '../common/gateways/base.gateway';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageHistoryQueryDto } from './dto/message-history-query.dto';
import { PlayerService } from '../player/player.service';

/**
 * WebSocket Gateway for real-time chat functionality
 */
@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: [
      'http://localhost:5173',
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
      /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
    ],
    credentials: true,
  },
})
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
   */
  async handleConnection(client: Socket): Promise<void> {
    super.handleConnection(client);

    try {
      // Extract playerId from handshake query
      const playerId = client.handshake.query.playerId as string;

      if (!playerId) {
        this.logger.warn(
          `Chat connection without playerId: ${client.id}`,
        );
        return;
      }

      // Get player details to find their session
      const player = await this.playerService.findOne(playerId, ['session']);

      this.logger.log(
        `Player ${player.name} connected to chat for session ${player.session.id}`,
      );

      // Auto-join the player to their session's chat room
      const room = `chat:session:${player.session.id}`;
      this.joinRoom(client, room);
    } catch (error) {
      this.logger.error(
        `Failed to handle chat connection: ${error.message}`,
      );
    }
  }

  /**
   * Handle send-message event
   */
  @SubscribeMessage('send-message')
  async handleSendMessage(
    @MessageBody() dto: SendMessageDto,
    @ConnectedSocket() client: Socket,
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
      this.logger.error(`Failed to send message: ${error.message}`);

      // Emit error to the sender
      client.emit('chat:error', {
        error: error.message,
        code: error.constructor.name,
      });
    }
  }

  /**
   * Handle load-history event
   */
  @SubscribeMessage('load-history')
  async handleLoadHistory(
    @MessageBody() query: MessageHistoryQueryDto,
    @ConnectedSocket() client: Socket,
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
      this.logger.error(`Failed to load history: ${error.message}`);

      client.emit('chat:error', {
        error: error.message,
        code: error.constructor.name,
      });
    }
  }

  /**
   * Handle join-chat event (explicit join for a session)
   */
  @SubscribeMessage('join-chat')
  handleJoinChat(
    @MessageBody() data: { sessionId: string; playerId: string },
    @ConnectedSocket() client: Socket,
  ): { status: string; sessionId: string } {
    const room = `chat:session:${data.sessionId}`;
    this.joinRoom(client, room);

    this.logger.log(
      `Player ${data.playerId} explicitly joined chat room for session ${data.sessionId}`,
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
    @MessageBody() data: { sessionId: string; playerId: string },
    @ConnectedSocket() client: Socket,
  ): { status: string; sessionId: string } {
    const room = `chat:session:${data.sessionId}`;
    this.leaveRoom(client, room);

    this.logger.log(
      `Player ${data.playerId} left chat room for session ${data.sessionId}`,
    );

    return {
      status: 'left',
      sessionId: data.sessionId,
    };
  }
}
