import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Creates an in-memory SQLite database configuration for testing
 * This is much faster than using PostgreSQL and doesn't require external services
 *
 * Note: For unit tests, prefer using mock repositories instead of a real database.
 * This configuration is primarily for integration/E2E tests.
 */
export const getTestDatabaseConfig = (): TypeOrmModuleOptions =>
  ({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [__dirname + '/../../src/**/*.entity.{ts,js}'],
    synchronize: true,
    dropSchema: true,
    logging: false,
  }) as TypeOrmModuleOptions;

/**
 * Helper to create a clean test database configuration for each test suite
 * Use this in Test.createTestingModule() to get a fresh database for each test file
 */
export const createTestDatabaseConfig = (): TypeOrmModuleOptions =>
  ({
    ...getTestDatabaseConfig(),
    // Generate unique database name for parallel test execution
    database: ':memory:',
  }) as TypeOrmModuleOptions;

/**
 * Create a mock TypeORM repository for unit testing
 * This avoids the need for a real database in unit tests
 */
export const createMockRepository = <T = any>() => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
  findAndCount: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
    getManyAndCount: jest.fn(),
    execute: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  })),
});
