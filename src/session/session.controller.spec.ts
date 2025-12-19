import { Test, TestingModule } from '@nestjs/testing';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { GameResponseDto } from '../common/dto/game.response';

describe('SessionController', () => {
  let controller: SessionController;
  let service: SessionService;

  const mockSessionService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
      ],
    }).compile();

    controller = module.get<SessionController>(SessionController);
    service = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSessionGames', () => {
    it('should return games with minPlayers and maxPlayers from gameLibrary', async () => {
      // Arrange
      const sessionId = 'test-session-id';
      const mockSession = {
        id: sessionId,
        games: [
          {
            id: 'game-1',
            name: 'Test Game',
            status: 'PENDING',
            currentRound: 0,
            maxRounds: 3,
            currentTurnTeamId: null,
            turnStartedAt: null,
            turnTimeLimit: null,
            session: { id: sessionId },
            gameLibrary: {
              id: 'lib-1',
              name: 'Cards Against Humanity',
              description: 'A party game for horrible people',
              minPlayers: 2,
              maxPlayers: 10,
            },
            teams: [],
            scores: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockSessionService.findOne.mockResolvedValue(mockSession);

      // Act
      const result = await controller.getSessionGames(sessionId);

      // Assert
      expect(service.findOne).toHaveBeenCalledWith(sessionId, [
        'games',
        'games.gameLibrary',
      ]);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'game-1',
        name: 'Test Game',
        minPlayers: 2,
        maxPlayers: 10,
        description: 'A party game for horrible people',
      });
      expect(result[0].minPlayers).toBe(2);
      expect(result[0].maxPlayers).toBe(10);
      expect(result[0].minPlayers).not.toBeNaN();
      expect(result[0].maxPlayers).not.toBeNaN();
    });

    it('should handle games without gameLibrary gracefully', async () => {
      // Arrange
      const sessionId = 'test-session-id';
      const mockSession = {
        id: sessionId,
        games: [
          {
            id: 'game-1',
            name: 'Test Game',
            status: 'PENDING',
            currentRound: 0,
            maxRounds: 3,
            currentTurnTeamId: null,
            turnStartedAt: null,
            turnTimeLimit: null,
            session: { id: sessionId },
            gameLibrary: null, // Missing gameLibrary
            teams: [],
            scores: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockSessionService.findOne.mockResolvedValue(mockSession);

      // Act
      const result = await controller.getSessionGames(sessionId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].minPlayers).toBe(0);
      expect(result[0].maxPlayers).toBe(0);
      expect(result[0].description).toBeNull();
    });

    it('should load gameLibrary relation to avoid NaN values', async () => {
      // This test specifically addresses the "NaN too many players" bug
      // Regression test: Ensures gameLibrary is always loaded

      const sessionId = 'test-session-id';
      await controller.getSessionGames(sessionId);

      // Verify that the service is called with the correct relations
      expect(service.findOne).toHaveBeenCalledWith(
        sessionId,
        expect.arrayContaining(['games', 'games.gameLibrary']),
      );
    });
  });
});
