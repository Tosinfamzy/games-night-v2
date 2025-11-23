# Test Utilities

This directory contains testing infrastructure and utilities for the Games Night v2 application.

## Files

### test-db.ts
Database testing utilities:
- `createTestDatabaseConfig()` - In-memory SQLite configuration for integration/E2E tests
- `createMockRepository()` - Mock TypeORM repository for unit tests (recommended for most tests)

### test-helpers.ts
Mock entity factories for creating test data:
- `createMockUser()` - Create a mock User entity
- `createMockGamesMaster()` - Create a mock GamesMaster entity
- `createMockSession()` - Create a mock Session entity
- `createMockPlayer()` - Create a mock Player entity
- `createMockTeam()` - Create a mock Team entity
- `createMockGame()` - Create a mock Game entity
- `createMockScore()` - Create a mock Score entity
- `createMockGameLibrary()` - Create a mock GameLibrary entity
- `createCompleteTestScenario()` - Create a full scenario with all related entities
- `resetTestCounters()` - Reset ID counters for predictable test data

### auth-helpers.ts
Authentication testing utilities:
- `generateTestAccessToken()` - Generate JWT access token
- `generateTestRefreshToken()` - Generate JWT refresh token
- `generateTestTokens()` - Generate both access and refresh tokens
- `createAuthHeader()` - Create authorization header for HTTP requests
- `createAuthenticatedTestUser()` - Create user with auth tokens
- `createAuthenticatedGamesMaster()` - Create games master with auth tokens
- `createAuthenticatedPlayer()` - Create player with auth tokens
- `createMockJwtPayload()` - Create mock JWT payload
- `createMockAuthRequest()` - Create mock request with authenticated user
- `createMockExecutionContext()` - Create mock execution context for guards

## Usage Examples

### Unit Test with Mock Repository

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMockRepository } from '../utils/test-db';
import { createMockUser } from '../utils/test-helpers';
import { UserService } from '../../src/user/user.service';
import { User } from '../../src/user/user.entity';

describe('UserService', () => {
  let service: UserService;
  let mockRepo;

  beforeEach(async () => {
    mockRepo = createMockRepository<User>();

    const module = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get(UserService);
  });

  it('should find a user by email', async () => {
    const mockUser = createMockUser({ email: 'test@example.com' });
    mockRepo.findOne.mockResolvedValue(mockUser);

    const result = await service.findByEmail('test@example.com');

    expect(result).toEqual(mockUser);
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
    });
  });
});
```

### Authentication Test

```typescript
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import {
  createAuthenticatedGamesMaster,
  generateTestAccessToken,
} from '../utils/auth-helpers';
import { createMockUser } from '../utils/test-helpers';

describe('AuthService', () => {
  let jwtService: JwtService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '15m' },
        }),
      ],
    }).compile();

    jwtService = module.get(JwtService);
  });

  it('should generate valid tokens', () => {
    const user = createMockUser();
    const token = generateTestAccessToken(user, jwtService);

    const decoded = jwtService.verify(token);
    expect(decoded.sub).toBe(user.id);
    expect(decoded.email).toBe(user.email);
  });

  it('should create authenticated games master', () => {
    const authGM = createAuthenticatedGamesMaster(jwtService);

    expect(authGM.user.role).toBe(UserRole.GAMES_MASTER);
    expect(authGM.accessToken).toBeDefined();
    expect(authGM.authHeader).toBeDefined();
  });
});
```

### E2E Test with Authentication

```typescript
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { createAuthenticatedGamesMaster } from '../utils/auth-helpers';

describe('SessionController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    jwtService = moduleFixture.get(JwtService);
    await app.init();
  });

  it('/sessions (POST) - authenticated', () => {
    const { authHeader } = createAuthenticatedGamesMaster(jwtService);

    return request(app.getHttpServer())
      .post('/sessions')
      .set(authHeader)
      .send({
        name: 'Test Session',
        date: new Date().toISOString(),
        gamesMasterId: 'test-gm-id',
      })
      .expect(201);
  });
});
```

### Creating Complex Test Scenarios

```typescript
import { createCompleteTestScenario } from '../utils/test-helpers';

it('should calculate session leaderboard', () => {
  const scenario = createCompleteTestScenario();

  // scenario contains:
  // - user (games master)
  // - gamesMaster
  // - session
  // - gameLibrary
  // - game
  // - players (array of 2)
  // - teams (array of 2)
  // - scores (array of 2)

  const leaderboard = calculateLeaderboard(scenario.session, scenario.scores);

  expect(leaderboard).toHaveLength(2);
});
```

## Best Practices

1. **Use Mock Repositories for Unit Tests** - Avoid database connections in unit tests. Use `createMockRepository()` instead.

2. **Reset Counters Between Tests** - Call `resetTestCounters()` in `beforeEach()` for predictable test data IDs.

3. **Use Factory Functions** - Always use the factory functions (`createMock*`) instead of manually creating entities.

4. **Isolate Tests** - Each test should be independent. Don't rely on test execution order.

5. **Mock External Dependencies** - Mock all external services (database, Redis, etc.) in unit tests.

6. **Type Safety** - The mock factories return `Partial<Entity>` types, allowing you to override specific fields while getting defaults for the rest.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run specific test file
npm test -- user.service.spec

# Run E2E tests
npm run test:e2e
```

## Test Coverage Goals

- **Unit Tests**: Aim for 80%+ coverage
- **Integration Tests**: Cover critical user flows
- **E2E Tests**: Cover happy paths and major error scenarios

## Adding New Test Utilities

When adding new utilities to this directory:

1. Follow the existing naming conventions
2. Add JSDoc comments for all exported functions
3. Include usage examples in this README
4. Update `test-setup.example.spec.ts` with examples if applicable
