import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { createMockRepository } from './test-db';
import {
  createMockUser,
  createMockSession,
  createMockGame,
  createCompleteTestScenario,
  resetTestCounters,
} from './test-helpers';
import {
  generateTestAccessToken,
  createAuthenticatedGamesMaster,
  createMockExecutionContext,
} from './auth-helpers';
import { UserRole } from '../../src/user/user.entity';

/**
 * Example test file demonstrating how to use the test utilities
 * This file shows best practices for setting up tests in this project
 */

describe('Test Infrastructure Example', () => {
  let module: TestingModule;
  let jwtService: JwtService;

  beforeAll(async () => {
    // Example: Setting up a test module with JWT (no database needed for unit tests)
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        JwtModule.register({
          secret: 'test-secret-key',
          signOptions: { expiresIn: '15m' },
        }),
      ],
    }).compile();

    jwtService = module.get(JwtService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    // Reset counters for predictable test data
    resetTestCounters();
  });

  describe('Mock Entity Factories', () => {
    it('should create a mock user', () => {
      const user = createMockUser({
        email: 'test@example.com',
        role: UserRole.GAMES_MASTER,
      });

      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe(UserRole.GAMES_MASTER);
      expect(user.id).toBeDefined();
    });

    it('should create a mock session', () => {
      const session = createMockSession({
        name: 'Friday Night Games',
      });

      expect(session.name).toBe('Friday Night Games');
      expect(session.joinCode).toHaveLength(6);
      expect(session.id).toBeDefined();
    });

    it('should create a complete test scenario', () => {
      const scenario = createCompleteTestScenario();

      expect(scenario.user).toBeDefined();
      expect(scenario.gamesMaster).toBeDefined();
      expect(scenario.session).toBeDefined();
      expect(scenario.game).toBeDefined();
      expect(scenario.players).toHaveLength(2);
      expect(scenario.teams).toHaveLength(2);
      expect(scenario.scores).toHaveLength(2);
    });
  });

  describe('Authentication Helpers', () => {
    it('should generate a valid JWT token', () => {
      const user = createMockUser();
      const token = generateTestAccessToken(user, jwtService);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token can be decoded
      const decoded = jwtService.verify(token);
      expect(decoded.sub).toBe(user.id);
      expect(decoded.email).toBe(user.email);
    });

    it('should create an authenticated games master', () => {
      const authGM = createAuthenticatedGamesMaster(jwtService);

      expect(authGM.user.role).toBe(UserRole.GAMES_MASTER);
      expect(authGM.accessToken).toBeDefined();
      expect(authGM.refreshToken).toBeDefined();
      expect(authGM.authHeader.Authorization).toContain('Bearer ');
    });

    it('should create a mock execution context', () => {
      const user = createMockUser();
      const context = createMockExecutionContext(user);

      const request = context.switchToHttp().getRequest() as any;
      expect(request.user).toBeDefined();
      expect(request.user.id).toBe(user.id);
    });
  });

  describe('Mock Repository', () => {
    it('should create a mock repository with all methods', () => {
      const mockRepo = createMockRepository();

      expect(mockRepo.find).toBeDefined();
      expect(mockRepo.findOne).toBeDefined();
      expect(mockRepo.save).toBeDefined();
      expect(mockRepo.create).toBeDefined();
      expect(mockRepo.update).toBeDefined();
      expect(mockRepo.delete).toBeDefined();
      expect(mockRepo.createQueryBuilder).toBeDefined();
    });

    it('should allow mocking repository methods', () => {
      const mockRepo = createMockRepository();
      const mockUser = createMockUser();

      (mockRepo.findOne as jest.Mock).mockResolvedValue(mockUser);

      expect(mockRepo.findOne).toHaveBeenCalledTimes(0);
    });
  });
});
