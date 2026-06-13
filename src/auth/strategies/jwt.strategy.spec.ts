import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { createMockUser } from '../../../test/utils/test-helpers';
import { UserRole } from '../../user/user.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let userService: any;
  let configService: any;

  beforeEach(() => {
    userService = {
      findById: jest.fn(),
    };

    configService = {
      get: jest.fn(),
    };

    // Mock JWT_SECRET to be defined by default
    configService.get.mockReturnValue('test-secret-key');
  });

  describe('constructor', () => {
    it('should throw error if JWT_SECRET is not defined', () => {
      configService.get.mockReturnValue(undefined);

      expect(() => {
        new JwtStrategy(configService, userService);
      }).toThrow('JWT_SECRET is not defined in environment variables');
    });

    it('should initialize successfully with valid JWT_SECRET', () => {
      configService.get.mockReturnValue('test-secret-key');

      expect(() => {
        new JwtStrategy(configService, userService);
      }).not.toThrow();
    });
  });

  describe('validate', () => {
    beforeEach(() => {
      strategy = new JwtStrategy(configService, userService);
    });

    it('should return user when user exists', async () => {
      const payload: JwtPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        role: UserRole.PLAYER,
      };

      const mockUser = createMockUser({
        id: 'user-1',
        email: 'test@example.com',
        role: UserRole.PLAYER,
      });

      userService.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual(mockUser);
      expect(userService.findById).toHaveBeenCalledWith('user-1');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const payload: JwtPayload = {
        sub: 'non-existent-user',
        email: 'test@example.com',
        role: UserRole.PLAYER,
      };

      userService.findById.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(payload)).rejects.toThrow(
        'User not found',
      );
      expect(userService.findById).toHaveBeenCalledWith('non-existent-user');
    });

    it('should validate GAMES_MASTER role', async () => {
      const payload: JwtPayload = {
        sub: 'gm-1',
        email: 'gm@example.com',
        role: UserRole.GAMES_MASTER,
        profileId: 'gm-profile-1',
      };

      const mockUser = createMockUser({
        id: 'gm-1',
        email: 'gm@example.com',
        role: UserRole.GAMES_MASTER,
      });

      userService.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual(mockUser);
      expect(userService.findById).toHaveBeenCalledWith('gm-1');
    });
  });
});
