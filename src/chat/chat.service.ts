import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Message } from './chat.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageHistoryQueryDto } from './dto/message-history-query.dto';
import { MessageResponseDto } from '../common/dto/message.response';
import { Player } from '../player/player.entity';
import { Session } from '../session/session.entity';
import { MessageType } from './enums/message-type.enum';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
  ) {}

  /**
   * Save a new message to the database
   */
  async saveMessage(dto: SendMessageDto): Promise<MessageResponseDto> {
    // Validate session exists
    const session = await this.sessionRepo.findOne({
      where: { id: dto.sessionId },
    });

    if (!session) {
      throw new NotFoundException(
        `Session with ID ${dto.sessionId} not found`,
      );
    }

    // Validate player exists and belongs to session
    const player = await this.playerRepo.findOne({
      where: { id: dto.playerId },
      relations: ['session'],
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${dto.playerId} not found`);
    }

    if (player.session.id !== dto.sessionId) {
      throw new ForbiddenException(
        'Player does not belong to this session',
      );
    }

    // Sanitize content (basic XSS prevention)
    const sanitizedContent = dto.content.trim();

    if (!sanitizedContent) {
      throw new BadRequestException('Message content cannot be empty');
    }

    // Create and save message
    const message = this.messageRepo.create({
      content: sanitizedContent,
      session,
      player,
      type: MessageType.TEXT,
    });

    const savedMessage = await this.messageRepo.save(message);

    return MessageResponseDto.fromEntity(savedMessage);
  }

  /**
   * Get message history for a session with pagination
   */
  async getMessageHistory(
    query: MessageHistoryQueryDto,
  ): Promise<{ messages: MessageResponseDto[]; hasMore: boolean }> {
    // Validate session exists
    const session = await this.sessionRepo.findOne({
      where: { id: query.sessionId },
    });

    if (!session) {
      throw new NotFoundException(
        `Session with ID ${query.sessionId} not found`,
      );
    }

    const limit = query.limit || 50;

    // Build query
    const queryBuilder = this.messageRepo
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.session', 'session')
      .leftJoinAndSelect('message.player', 'player')
      .where('message.session.id = :sessionId', { sessionId: query.sessionId })
      .orderBy('message.createdAt', 'DESC')
      .take(limit + 1); // Fetch one extra to check if there are more

    // Apply cursor pagination if beforeMessageId is provided
    if (query.beforeMessageId) {
      const beforeMessage = await this.messageRepo.findOne({
        where: { id: query.beforeMessageId },
      });

      if (beforeMessage) {
        queryBuilder.andWhere('message.createdAt < :beforeDate', {
          beforeDate: beforeMessage.createdAt,
        });
      }
    }

    const messages = await queryBuilder.getMany();

    // Check if there are more messages
    const hasMore = messages.length > limit;

    // Return only the requested number of messages
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    return {
      messages: resultMessages.map((msg) => MessageResponseDto.fromEntity(msg)),
      hasMore,
    };
  }

  /**
   * Validate that a player belongs to a session
   */
  async validatePlayerInSession(
    playerId: string,
    sessionId: string,
  ): Promise<boolean> {
    const player = await this.playerRepo.findOne({
      where: { id: playerId },
      relations: ['session'],
    });

    if (!player) {
      return false;
    }

    return player.session.id === sessionId;
  }

  /**
   * Find a message by ID
   */
  async findOne(id: string): Promise<Message> {
    const message = await this.messageRepo.findOne({
      where: { id },
      relations: ['session', 'player'],
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }

    return message;
  }
}
