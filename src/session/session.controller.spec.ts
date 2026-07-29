import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { HostGuard } from '../auth/guards/host.guard';
import { SessionActorGuard } from '../auth/guards/session-actor.guard';
import {
  ClerkAuthGuard,
  OptionalClerkAuthGuard,
} from '../auth/guards/clerk-auth.guard';

describe('SessionController', () => {
  let controller: SessionController;
  let service: SessionService;

  const mockSessionService = {
    findOne: jest.fn(),
    create: jest.fn(),
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
    })
      // HostGuard is exercised in e2e; unit tests call methods directly.
      .overrideGuard(HostGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SessionActorGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OptionalClerkAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ClerkAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SessionController>(SessionController);
    service = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create — host identity', () => {
    const OLD_ENV = process.env.NODE_ENV;
    const dto = { name: 'Game Night', gamesMasterId: 'gm-from-body' } as never;
    afterEach(() => {
      process.env.NODE_ENV = OLD_ENV;
    });

    it('uses the Clerk games master when signed in', async () => {
      mockSessionService.create.mockResolvedValue({});
      await controller.create(dto, { id: 'gm-clerk' } as never);
      expect(mockSessionService.create).toHaveBeenCalledWith(
        expect.objectContaining({ gamesMasterId: 'gm-clerk' }),
      );
    });

    it('falls back to the body gamesMasterId outside production', async () => {
      process.env.NODE_ENV = 'test';
      mockSessionService.create.mockResolvedValue({});
      await controller.create(dto, undefined);
      expect(mockSessionService.create).toHaveBeenCalledWith(
        expect.objectContaining({ gamesMasterId: 'gm-from-body' }),
      );
    });

    it('rejects an anonymous create in production (no host spoofing)', () => {
      process.env.NODE_ENV = 'production';
      // The host check runs synchronously before the async service call.
      expect(() => controller.create(dto, undefined)).toThrow(
        UnauthorizedException,
      );
      expect(mockSessionService.create).not.toHaveBeenCalled();
    });
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
