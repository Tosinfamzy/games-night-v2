import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ErrorCode } from '../errors/error-code.enum';

interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
  body?: unknown;
  statusCode?: number;
}

function mockResponse(): MockResponse {
  const res: MockResponse = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
}

function httpHost(res: MockResponse, url = '/v1/resource'): ArgumentsHost {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ method: 'GET', url }),
    }),
  } as unknown as ArgumentsHost;
}

function wsHost(client: { emit: jest.Mock }): ArgumentsHost {
  return {
    getType: () => 'ws',
    switchToWs: () => ({ getClient: () => client }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeAll(() => {
    // Silence the filter's own logging during tests.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterAll(() => jest.restoreAllMocks());

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  describe('HTTP', () => {
    it('maps a NotFoundException to a NOT_FOUND envelope, preserving the message', () => {
      const res = mockResponse();
      filter.catch(
        new NotFoundException('Game with ID abc not found'),
        httpHost(res, '/v1/games/abc'),
      );

      expect(res.statusCode).toBe(404);
      expect(res.body).toMatchObject({
        statusCode: 404,
        code: ErrorCode.NOT_FOUND,
        message: 'Game with ID abc not found',
        path: '/v1/games/abc',
      });
      expect((res.body as { timestamp: string }).timestamp).toEqual(
        expect.any(String),
      );
    });

    it('maps class-validator errors to VALIDATION_ERROR with details', () => {
      const res = mockResponse();
      filter.catch(
        new BadRequestException(['name must be a string', 'code is required']),
        httpHost(res),
      );

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({
        statusCode: 400,
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: ['name must be a string', 'code is required'],
      });
    });

    it('derives the code from the status for other HTTP exceptions', () => {
      const res = mockResponse();
      filter.catch(new ForbiddenException('Nope'), httpHost(res));

      expect(res.statusCode).toBe(403);
      expect(res.body).toMatchObject({
        code: ErrorCode.FORBIDDEN,
        message: 'Nope',
      });
    });

    it('does not leak internals for unexpected (non-HTTP) errors', () => {
      const res = mockResponse();
      filter.catch(new Error('DB password is hunter2'), httpHost(res));

      expect(res.statusCode).toBe(500);
      expect(res.body).toMatchObject({
        statusCode: 500,
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
      });
      expect(JSON.stringify(res.body)).not.toContain('hunter2');
    });

    it('respects an explicit code on the exception response body', () => {
      const res = mockResponse();
      filter.catch(
        new BadRequestException({
          message: 'Session is not joinable',
          code: 'SESSION_NOT_JOINABLE',
        }),
        httpHost(res),
      );

      expect(res.body).toMatchObject({
        code: 'SESSION_NOT_JOINABLE',
        message: 'Session is not joinable',
      });
    });
  });

  describe('WebSocket', () => {
    it('emits an `exception` event with a matching envelope', () => {
      const client = { emit: jest.fn() };
      filter.catch(new WsException('Not in this session'), wsHost(client));

      expect(client.emit).toHaveBeenCalledWith(
        'exception',
        expect.objectContaining({
          code: expect.any(String),
          message: 'Not in this session',
          timestamp: expect.any(String),
        }),
      );
    });

    it('never throws if the client socket is gone', () => {
      const client = {
        emit: jest.fn(() => {
          throw new Error('socket closed');
        }),
      };
      expect(() =>
        filter.catch(new WsException('boom'), wsHost(client)),
      ).not.toThrow();
    });
  });
});
