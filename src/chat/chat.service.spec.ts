import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { Message } from './chat.entity';
import { Player } from '../player/player.entity';
import { Session } from '../session/session.entity';
import { MessageType } from './enums/message-type.enum';
import { createMockRepository } from '../../test/utils/test-db';
import {
  createMockPlayer,
  createMockSession,
  resetTestCounters,
} from '../../test/utils/test-helpers';

// Helper to create mock message
const createMockMessage = (overrides?: Partial<Message>): Message => {
  const message = new Message();
  message.id = overrides?.id || 'message-1';
  message.content = overrides?.content || 'Hello everyone!';
  message.session = overrides?.session || (createMockSession() as Session);
  message.player = overrides?.player || (createMockPlayer() as Player);
  message.type = overrides?.type || MessageType.TEXT;
  message.isEdited = overrides?.isEdited || false;
  message.editedAt = overrides?.editedAt;
  message.createdAt = overrides?.createdAt || new Date();
  message.updatedAt = overrides?.updatedAt || new Date();
  return message;
};

describe('ChatService', () => {
  let service: ChatService;
  let messageRepo: ReturnType<typeof createMockRepository>;
  let playerRepo: ReturnType<typeof createMockRepository>;
  let sessionRepo: ReturnType<typeof createMockRepository>;

  beforeEach(async () => {
    messageRepo = createMockRepository();
    playerRepo = createMockRepository();
    sessionRepo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getRepositoryToken(Message),
          useValue: messageRepo,
        },
        {
          provide: getRepositoryToken(Player),
          useValue: playerRepo,
        },
        {
          provide: getRepositoryToken(Session),
          useValue: sessionRepo,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    resetTestCounters();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('saveMessage', () => {
    it('should save a message successfully', async () => {
      const session = createMockSession({ id: 'session-1' });
      const player = createMockPlayer({
        id: 'player-1',
        name: 'Alice',
        session: session as Session,
      });

      const dto = {
        content: 'Hello everyone!',
        sessionId: 'session-1',
        playerId: 'player-1',
      };

      sessionRepo.findOne.mockResolvedValue(session);
      playerRepo.findOne.mockResolvedValue(player);

      const savedMessage = createMockMessage({
        content: dto.content,
        session: session as Session,
        player: player as Player,
      });
      messageRepo.create.mockReturnValue(savedMessage);
      messageRepo.save.mockResolvedValue(savedMessage);

      const result = await service.saveMessage(dto);

      expect(result.content).toBe('Hello everyone!');
      expect(result.playerName).toBe('Alice');
      expect(result.sessionId).toBe('session-1');
      expect(messageRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if session not found', async () => {
      const dto = {
        content: 'Hello',
        sessionId: 'non-existent-session',
        playerId: 'player-1',
      };

      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.saveMessage(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if player not found', async () => {
      const session = createMockSession({ id: 'session-1' });
      const dto = {
        content: 'Hello',
        sessionId: 'session-1',
        playerId: 'non-existent-player',
      };

      sessionRepo.findOne.mockResolvedValue(session);
      playerRepo.findOne.mockResolvedValue(null);

      await expect(service.saveMessage(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if player not in session', async () => {
      const session = createMockSession({ id: 'session-1' });
      const differentSession = createMockSession({ id: 'session-2' });
      const player = createMockPlayer({
        id: 'player-1',
        session: differentSession as Session,
      });

      const dto = {
        content: 'Hello',
        sessionId: 'session-1',
        playerId: 'player-1',
      };

      sessionRepo.findOne.mockResolvedValue(session);
      playerRepo.findOne.mockResolvedValue(player);

      await expect(service.saveMessage(dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if content is empty after trim', async () => {
      const session = createMockSession({ id: 'session-1' });
      const player = createMockPlayer({
        id: 'player-1',
        session: session as Session,
      });

      const dto = {
        content: '   ', // Only whitespace
        sessionId: 'session-1',
        playerId: 'player-1',
      };

      sessionRepo.findOne.mockResolvedValue(session);
      playerRepo.findOne.mockResolvedValue(player);

      await expect(service.saveMessage(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should trim whitespace from message content', async () => {
      const session = createMockSession({ id: 'session-1' });
      const player = createMockPlayer({
        id: 'player-1',
        session: session as Session,
      });

      const dto = {
        content: '  Hello everyone!  ',
        sessionId: 'session-1',
        playerId: 'player-1',
      };

      sessionRepo.findOne.mockResolvedValue(session);
      playerRepo.findOne.mockResolvedValue(player);

      const savedMessage = createMockMessage({
        content: 'Hello everyone!',
        session: session as Session,
        player: player as Player,
      });
      messageRepo.create.mockReturnValue(savedMessage);
      messageRepo.save.mockResolvedValue(savedMessage);

      await service.saveMessage(dto);

      expect(messageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Hello everyone!',
        }),
      );
    });
  });

  describe('getMessageHistory', () => {
    it('should return message history for a session', async () => {
      const session = createMockSession({ id: 'session-1' });
      const messages = [
        createMockMessage({
          id: 'msg-1',
          content: 'Message 1',
          createdAt: new Date('2025-01-01T10:00:00Z'),
        }),
        createMockMessage({
          id: 'msg-2',
          content: 'Message 2',
          createdAt: new Date('2025-01-01T10:01:00Z'),
        }),
      ];

      const query = {
        sessionId: 'session-1',
        limit: 50,
      };

      sessionRepo.findOne.mockResolvedValue(session);

      // Mock query builder
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(messages),
      } as any;
      messageRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getMessageHistory(query);

      expect(result.messages).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.messages[0].content).toBe('Message 1');
    });

    it('should throw NotFoundException if session not found', async () => {
      const query = {
        sessionId: 'non-existent-session',
        limit: 50,
      };

      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.getMessageHistory(query)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should indicate hasMore when messages exceed limit', async () => {
      const session = createMockSession({ id: 'session-1' });
      // Create 51 messages (limit is 50, so hasMore should be true)
      const messages = Array.from({ length: 51 }, (_, i) =>
        createMockMessage({
          id: `msg-${i}`,
          content: `Message ${i}`,
        }),
      );

      const query = {
        sessionId: 'session-1',
        limit: 50,
      };

      sessionRepo.findOne.mockResolvedValue(session);

      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(messages),
      } as any;
      messageRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getMessageHistory(query);

      expect(result.messages).toHaveLength(50); // Should return only 50
      expect(result.hasMore).toBe(true);
    });

    it('should handle cursor pagination with beforeMessageId', async () => {
      const session = createMockSession({ id: 'session-1' });
      const beforeMessage = createMockMessage({
        id: 'msg-10',
        createdAt: new Date('2025-01-01T10:10:00Z'),
      });
      const messages = [
        createMockMessage({
          id: 'msg-8',
          createdAt: new Date('2025-01-01T10:08:00Z'),
        }),
        createMockMessage({
          id: 'msg-9',
          createdAt: new Date('2025-01-01T10:09:00Z'),
        }),
      ];

      const query = {
        sessionId: 'session-1',
        limit: 50,
        beforeMessageId: 'msg-10',
      };

      sessionRepo.findOne.mockResolvedValue(session);
      messageRepo.findOne.mockResolvedValue(beforeMessage);

      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(messages),
      } as any;
      messageRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getMessageHistory(query);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'message.createdAt < :beforeDate',
        { beforeDate: beforeMessage.createdAt },
      );
      expect(result.messages).toHaveLength(2);
    });
  });

  describe('validatePlayerInSession', () => {
    it('should return true if player is in session', async () => {
      const session = createMockSession({ id: 'session-1' });
      const player = createMockPlayer({
        id: 'player-1',
        session: session as Session,
      });

      playerRepo.findOne.mockResolvedValue(player);

      const result = await service.validatePlayerInSession(
        'player-1',
        'session-1',
      );

      expect(result).toBe(true);
    });

    it('should return false if player not found', async () => {
      playerRepo.findOne.mockResolvedValue(null);

      const result = await service.validatePlayerInSession(
        'non-existent-player',
        'session-1',
      );

      expect(result).toBe(false);
    });

    it('should return false if player not in session', async () => {
      const differentSession = createMockSession({ id: 'session-2' });
      const player = createMockPlayer({
        id: 'player-1',
        session: differentSession as Session,
      });

      playerRepo.findOne.mockResolvedValue(player);

      const result = await service.validatePlayerInSession(
        'player-1',
        'session-1',
      );

      expect(result).toBe(false);
    });
  });

  describe('findOne', () => {
    it('should find a message by ID', async () => {
      const message = createMockMessage({ id: 'message-1' });
      messageRepo.findOne.mockResolvedValue(message);

      const result = await service.findOne('message-1');

      expect(result).toEqual(message);
      expect(messageRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'message-1' },
        relations: ['session', 'player'],
      });
    });

    it('should throw NotFoundException if message not found', async () => {
      messageRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-message')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
