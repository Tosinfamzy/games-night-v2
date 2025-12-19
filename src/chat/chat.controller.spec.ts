import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { MessageResponseDto } from '../common/dto/message.response';

describe('ChatController', () => {
  let controller: ChatController;
  let service: ChatService;

  const mockChatService = {
    getMessageHistory: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: mockChatService,
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    service = module.get<ChatService>(ChatService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSessionMessages', () => {
    it('should return message history for a session', async () => {
      // Arrange
      const sessionId = 'test-session-id';
      const mockMessages: MessageResponseDto[] = [
        {
          id: 'msg-1',
          content: 'Hello!',
          playerId: 'player-1',
          playerName: 'John',
          sessionId,
          type: 'TEXT',
          isEdited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockResult = {
        messages: mockMessages,
        hasMore: false,
      };

      mockChatService.getMessageHistory.mockResolvedValue(mockResult);

      // Act
      const result = await controller.getSessionMessages(sessionId, {
        sessionId,
        limit: 50,
      });

      // Assert
      expect(service.getMessageHistory).toHaveBeenCalledWith({
        sessionId,
        limit: 50,
      });
      expect(result).toEqual(mockResult);
      expect(result.messages).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('should support pagination with beforeMessageId', async () => {
      // Arrange
      const sessionId = 'test-session-id';
      const beforeMessageId = 'msg-100';
      const mockResult = {
        messages: [],
        hasMore: true,
      };

      mockChatService.getMessageHistory.mockResolvedValue(mockResult);

      // Act
      const result = await controller.getSessionMessages(sessionId, {
        sessionId,
        limit: 20,
        beforeMessageId,
      });

      // Assert
      expect(service.getMessageHistory).toHaveBeenCalledWith({
        sessionId,
        limit: 20,
        beforeMessageId,
      });
      expect(result.hasMore).toBe(true);
    });

    it('should use default limit if not provided', async () => {
      // Arrange
      const sessionId = 'test-session-id';
      mockChatService.getMessageHistory.mockResolvedValue({
        messages: [],
        hasMore: false,
      });

      // Act
      await controller.getSessionMessages(sessionId, { sessionId });

      // Assert
      expect(service.getMessageHistory).toHaveBeenCalledWith({ sessionId });
    });
  });
});
