import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '../../src/user/user.entity';
import { createMockUser } from './test-helpers';

/**
 * Authentication helper utilities for testing
 * Provides JWT token generation and authenticated request helpers
 */

/**
 * Generate a JWT access token for testing
 * @param user - User entity or partial user data
 * @param jwtService - NestJS JwtService instance
 * @returns JWT access token string
 */
export const generateTestAccessToken = (
  user: Partial<User>,
  jwtService: JwtService,
): string => {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  return jwtService.sign(payload, {
    expiresIn: 900, // 15 minutes in seconds
  });
};

/**
 * Generate a JWT refresh token for testing
 * @param user - User entity or partial user data
 * @param jwtService - NestJS JwtService instance
 * @returns JWT refresh token string
 */
export const generateTestRefreshToken = (
  user: Partial<User>,
  jwtService: JwtService,
): string => {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  return jwtService.sign(payload, {
    expiresIn: 604800, // 7 days in seconds
  });
};

/**
 * Generate both access and refresh tokens for testing
 * @param user - User entity or partial user data
 * @param jwtService - NestJS JwtService instance
 * @returns Object with accessToken and refreshToken
 */
export const generateTestTokens = (
  user: Partial<User>,
  jwtService: JwtService,
): { accessToken: string; refreshToken: string } => {
  return {
    accessToken: generateTestAccessToken(user, jwtService),
    refreshToken: generateTestRefreshToken(user, jwtService),
  };
};

/**
 * Create authorization header for authenticated requests
 * @param token - JWT access token
 * @returns Authorization header object
 */
export const createAuthHeader = (token: string): { Authorization: string } => {
  return {
    Authorization: `Bearer ${token}`,
  };
};

/**
 * Create a test user with authentication tokens
 * Useful for E2E tests that need authenticated users
 */
export const createAuthenticatedTestUser = (
  jwtService: JwtService,
  overrides: Partial<User> = {},
) => {
  const user = createMockUser(overrides);
  const tokens = generateTestTokens(user, jwtService);

  return {
    user,
    ...tokens,
    authHeader: createAuthHeader(tokens.accessToken),
  };
};

/**
 * Create a test games master user with authentication tokens
 */
export const createAuthenticatedGamesMaster = (jwtService: JwtService) => {
  return createAuthenticatedTestUser(jwtService, {
    role: UserRole.GAMES_MASTER,
    name: 'Test Games Master',
  });
};

/**
 * Create a test player user with authentication tokens
 */
export const createAuthenticatedPlayer = (jwtService: JwtService) => {
  return createAuthenticatedTestUser(jwtService, {
    role: UserRole.PLAYER,
    name: 'Test Player',
  });
};

/**
 * Mock JWT payload for testing guards and decorators
 */
export interface MockJwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

/**
 * Create a mock JWT payload
 */
export const createMockJwtPayload = (
  overrides: Partial<MockJwtPayload> = {},
): MockJwtPayload => {
  const now = Math.floor(Date.now() / 1000);

  return {
    sub: overrides.sub || 'test-user-id',
    email: overrides.email || 'test@example.com',
    role: overrides.role || UserRole.PLAYER,
    iat: overrides.iat || now,
    exp: overrides.exp || now + 900, // 15 minutes
    ...overrides,
  };
};

/**
 * Create mock request object with authenticated user
 * Useful for unit testing guards and decorators
 */
export const createMockAuthRequest = (user: Partial<User> = {}) => {
  const mockUser = createMockUser(user);

  return {
    user: mockUser,
    headers: {},
    get: jest.fn(),
  };
};

/**
 * Create mock execution context for testing guards
 */
export const createMockExecutionContext = (user?: Partial<User>) => {
  const request = user ? createMockAuthRequest(user) : { headers: {}, get: jest.fn() };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  };
};
