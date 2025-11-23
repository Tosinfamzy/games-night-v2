import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { GamesMasterService } from '../games-master/games-master.service';
import { UserRole } from '../user/user.entity';
import * as bcrypt from 'bcrypt';
import { createMockUser, createMockGamesMaster } from '../../test/utils/test-helpers';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userService: any;
  let jwtService: any;
  let configService: any;
  let gamesMasterService: any;

  beforeEach(async () => {
    userService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn(),
    };

    gamesMasterService = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: userService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: GamesMasterService,
          useValue: gamesMasterService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should successfully signup a player', async () => {
      const signupDto = {
        email: 'player@example.com',
        password: 'password123',
        name: 'Test Player',
        role: UserRole.PLAYER,
      };

      const mockUser = createMockUser({
        id: 'user-1',
        email: signupDto.email,
        name: signupDto.name,
        role: UserRole.PLAYER,
        password: 'hashedPassword',
      });

      userService.findByEmail.mockResolvedValue(null); // Email not taken
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      userService.create.mockResolvedValue(mockUser);
      configService.get
        .mockReturnValueOnce('15m') // JWT_EXPIRATION
        .mockReturnValueOnce('7d'); // JWT_REFRESH_EXPIRATION
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.signup(signupDto);

      expect(userService.findByEmail).toHaveBeenCalledWith(signupDto.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(signupDto.password, 10);
      expect(userService.create).toHaveBeenCalledWith({
        email: signupDto.email,
        name: signupDto.name,
        password: 'hashedPassword',
        role: UserRole.PLAYER,
      });
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.email).toBe(signupDto.email);
      expect(gamesMasterService.create).not.toHaveBeenCalled();
    });

    it('should signup games master and create profile', async () => {
      const signupDto = {
        email: 'gm@example.com',
        password: 'password123',
        name: 'Test GM',
        role: UserRole.GAMES_MASTER,
      };

      const mockGamesMaster = createMockGamesMaster({
        id: 'gm-1',
        name: signupDto.name,
      });

      const mockUser = createMockUser({
        id: 'user-1',
        email: signupDto.email,
        name: signupDto.name,
        role: UserRole.GAMES_MASTER,
        password: 'hashedPassword',
        gamesMasterProfile: mockGamesMaster as any,
      });

      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      userService.create.mockResolvedValue({
        ...mockUser,
        gamesMasterProfile: undefined,
      });
      gamesMasterService.create.mockResolvedValue(mockGamesMaster);
      userService.update.mockResolvedValue(mockUser);
      configService.get
        .mockReturnValueOnce('15m')
        .mockReturnValueOnce('7d');
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.signup(signupDto);

      expect(gamesMasterService.create).toHaveBeenCalledWith({
        name: signupDto.name,
      });
      expect(userService.update).toHaveBeenCalledWith('user-1', {
        gamesMasterProfile: mockGamesMaster,
      });
      expect(result.user.gamesMasterId).toBe('gm-1');
    });

    it('should throw ConflictException if email already exists', async () => {
      const signupDto = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const existingUser = createMockUser({ email: signupDto.email });
      userService.findByEmail.mockResolvedValue(existingUser);

      await expect(service.signup(signupDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.signup(signupDto)).rejects.toThrow(
        'Email already exists',
      );
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('should hash password with bcrypt salt rounds 10', async () => {
      const signupDto = {
        email: 'test@example.com',
        password: 'mypassword',
        name: 'Test',
      };

      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      userService.create.mockResolvedValue(createMockUser());
      configService.get.mockReturnValue('15m');
      jwtService.sign.mockReturnValue('token');

      await service.signup(signupDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('mypassword', 10);
    });

    it('should default to PLAYER role if not specified', async () => {
      const signupDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test',
      };

      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      userService.create.mockResolvedValue(
        createMockUser({ role: UserRole.PLAYER }),
      );
      configService.get.mockReturnValue('15m');
      jwtService.sign.mockReturnValue('token');

      await service.signup(signupDto);

      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.PLAYER,
        }),
      );
    });

    it('should generate tokens with correct payload', async () => {
      const signupDto = {
        email: 'test@example.com',
        password: 'password',
        name: 'Test',
      };

      const mockUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
        role: UserRole.PLAYER,
      });

      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      userService.create.mockResolvedValue(mockUser);
      configService.get
        .mockReturnValueOnce('15m')
        .mockReturnValueOnce('7d');
      jwtService.sign.mockImplementation((payload) => JSON.stringify(payload));

      await service.signup(signupDto);

      const accessPayload = jwtService.sign.mock.calls[0][0];
      expect(accessPayload.sub).toBe('user-123');
      expect(accessPayload.email).toBe('test@example.com');
      expect(accessPayload.role).toBe(UserRole.PLAYER);
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const loginDto = {
        email: 'user@example.com',
        password: 'password123',
      };

      const mockUser = createMockUser({
        id: 'user-1',
        email: loginDto.email,
        password: 'hashedPassword',
      });

      userService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      configService.get.mockReturnValue('15m');
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.login(loginDto);

      expect(userService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        'hashedPassword',
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).toBeDefined();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const loginDto = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      userService.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password incorrect', async () => {
      const loginDto = {
        email: 'user@example.com',
        password: 'wrongpassword',
      };

      const mockUser = createMockUser({
        email: loginDto.email,
        password: 'hashedPassword',
      });

      userService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should return user data with tokens', async () => {
      const mockUser = createMockUser({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.PLAYER,
      });

      userService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      configService.get.mockReturnValue('15m');
      jwtService.sign
        .mockReturnValueOnce('access')
        .mockReturnValueOnce('refresh');

      const result = await service.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result.user.id).toBe('user-1');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.name).toBe('Test User');
      expect(result.user.role).toBe(UserRole.PLAYER);
    });

    it('should validate password using bcrypt compare', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'plaintext',
      };

      const mockUser = createMockUser({
        password: 'hashedPassword',
      });

      userService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      configService.get.mockReturnValue('15m');
      jwtService.sign.mockReturnValue('token');

      await service.login(loginDto);

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'plaintext',
        'hashedPassword',
      );
    });
  });

  describe('refreshToken', () => {
    it('should generate new tokens from valid refresh token', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockUser = createMockUser({
        id: 'user-1',
        email: 'test@example.com',
      });

      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      userService.findById.mockResolvedValue(mockUser);
      configService.get
        .mockReturnValueOnce('secret')
        .mockReturnValueOnce('15m')
        .mockReturnValueOnce('7d');
      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await service.refreshToken(refreshToken);

      expect(jwtService.verify).toHaveBeenCalledWith(refreshToken, {
        secret: 'secret',
      });
      expect(userService.findById).toHaveBeenCalledWith('user-1');
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should throw UnauthorizedException if token invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      configService.get.mockReturnValue('secret');

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      userService.findById.mockResolvedValue(null);
      configService.get.mockReturnValue('secret');

      await expect(service.refreshToken('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken('valid-token')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should handle expired token', async () => {
      jwtService.verify.mockImplementation(() => {
        const error: any = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });
      configService.get.mockReturnValue('secret');

      await expect(service.refreshToken('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword', () => {
    it('should successfully change password', async () => {
      const userId = 'user-1';
      const currentPassword = 'oldpassword';
      const newPassword = 'newpassword';

      const mockUser = createMockUser({
        id: userId,
        password: 'hashedOldPassword',
      });

      userService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedNewPassword');
      userService.update.mockResolvedValue(mockUser);

      const result = await service.changePassword(
        userId,
        currentPassword,
        newPassword,
      );

      expect(userService.findById).toHaveBeenCalledWith(userId);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        currentPassword,
        'hashedOldPassword',
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
      expect(userService.update).toHaveBeenCalledWith(userId, {
        password: 'hashedNewPassword',
      });
      expect(result.message).toBe('Password changed successfully');
    });

    it('should throw BadRequestException if user not found', async () => {
      userService.findById.mockResolvedValue(null);

      await expect(
        service.changePassword('invalid-id', 'old', 'new'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.changePassword('invalid-id', 'old', 'new'),
      ).rejects.toThrow('User not found');
    });

    it('should throw UnauthorizedException if current password wrong', async () => {
      const mockUser = createMockUser({
        password: 'hashedPassword',
      });

      userService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', 'wrongpassword', 'newpassword'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.changePassword('user-1', 'wrongpassword', 'newpassword'),
      ).rejects.toThrow('Current password is incorrect');
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(userService.update).not.toHaveBeenCalled();
    });

    it('should hash new password before saving', async () => {
      const mockUser = createMockUser({
        password: 'hashedOld',
      });

      userService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedNew');
      userService.update.mockResolvedValue(mockUser);

      await service.changePassword('user-1', 'old', 'new');

      expect(bcrypt.hash).toHaveBeenCalledWith('new', 10);
      expect(userService.update).toHaveBeenCalledWith('user-1', {
        password: 'hashedNew',
      });
    });
  });

  describe('validateUser', () => {
    it('should return user if exists', async () => {
      const mockUser = createMockUser({ id: 'user-1' });
      userService.findById.mockResolvedValue(mockUser);

      const result = await service.validateUser('user-1');

      expect(result).toEqual(mockUser);
      expect(userService.findById).toHaveBeenCalledWith('user-1');
    });

    it('should return null if user not found', async () => {
      userService.findById.mockResolvedValue(null);

      const result = await service.validateUser('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('token expiration parsing', () => {
    it('should parse minutes correctly', async () => {
      const mockUser = createMockUser();

      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      userService.create.mockResolvedValue(mockUser);
      jwtService.sign.mockClear();
      configService.get.mockImplementation((key: string) => {
        if (key === 'JWT_EXPIRATION') return '15m'; // 15 minutes
        if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
        return null;
      });

      jwtService.sign.mockReturnValue('token');

      await service.signup({
        email: 'test@example.com',
        password: 'password',
        name: 'Test',
      });

      // Check that the first call (access token) used 900 seconds (15m)
      expect(jwtService.sign.mock.calls[0][1].expiresIn).toBe(900);
    });

    it('should parse days correctly', async () => {
      const mockUser = createMockUser();

      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      userService.create.mockResolvedValue(mockUser);
      jwtService.sign.mockClear();
      configService.get.mockImplementation((key: string) => {
        if (key === 'JWT_EXPIRATION') return '15m';
        if (key === 'JWT_REFRESH_EXPIRATION') return '7d'; // 7 days
        return null;
      });

      jwtService.sign.mockReturnValue('token');

      await service.signup({
        email: 'test@example.com',
        password: 'password',
        name: 'Test',
      });

      // Check that the second call (refresh token) used 604800 seconds (7d)
      expect(jwtService.sign.mock.calls[1][1].expiresIn).toBe(604800);
    });

    it('should parse hours correctly', async () => {
      const mockUser = createMockUser();

      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      userService.create.mockResolvedValue(mockUser);
      jwtService.sign.mockClear();
      configService.get.mockImplementation((key: string) => {
        if (key === 'JWT_EXPIRATION') return '2h'; // 2 hours
        if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
        return null;
      });

      jwtService.sign.mockReturnValue('token');

      await service.signup({
        email: 'test@example.com',
        password: 'password',
        name: 'Test',
      });

      // Check that the first call (access token) used 7200 seconds (2h)
      expect(jwtService.sign.mock.calls[0][1].expiresIn).toBe(7200);
    });

    it('should parse seconds correctly', async () => {
      const mockUser = createMockUser();

      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      userService.create.mockResolvedValue(mockUser);
      jwtService.sign.mockClear();
      configService.get.mockImplementation((key: string) => {
        if (key === 'JWT_EXPIRATION') return '30s'; // 30 seconds
        if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
        return null;
      });

      jwtService.sign.mockReturnValue('token');

      await service.signup({
        email: 'test@example.com',
        password: 'password',
        name: 'Test',
      });

      // Check that the first call (access token) used 30 seconds (30s)
      expect(jwtService.sign.mock.calls[0][1].expiresIn).toBe(30);
    });
  });
});
