import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Request, Response } from 'express';
import { Socket } from 'socket.io';
import { getErrorMessage } from '../utils/error.util';
import {
  ErrorCode,
  ErrorResponseBody,
  codeForStatus,
} from '../errors/error-code.enum';

interface NormalizedError {
  message: string;
  details?: unknown;
  code?: string;
}

/**
 * Global exception filter: turns every thrown error into one consistent,
 * contract-stable shape so the frontend can branch on `code` instead of
 * sniffing messages.
 *
 * - HTTP: responds with { statusCode, code, message, details?, path, timestamp }.
 * - WebSocket: emits an `exception` event with { code, message, details?, timestamp }.
 *
 * Registered globally via APP_FILTER (see AppModule) so it applies in both the
 * running server and the e2e test harness. 5xx are logged with a stack; the
 * client never receives internal details for unexpected errors.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() === 'ws') {
      this.handleWs(exception, host);
      return;
    }
    this.handleHttp(exception, host);
  }

  private handleHttp(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const normalized = this.normalize(exception);
    const code = normalized.code ?? codeForStatus(status);

    this.log(status, code, `${request.method} ${request.url}`, exception);

    const body: ErrorResponseBody = {
      statusCode: status,
      code,
      message: normalized.message,
      ...(normalized.details !== undefined
        ? { details: normalized.details }
        : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private handleWs(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const normalized = this.normalize(exception);
    const code = normalized.code ?? codeForStatus(status);

    this.log(status, code, `ws ${client?.nsp?.name ?? ''}`.trim(), exception);

    // The socket may already be gone; never let error handling throw.
    try {
      client.emit('exception', {
        code,
        message: normalized.message,
        ...(normalized.details !== undefined
          ? { details: normalized.details }
          : {}),
        timestamp: new Date().toISOString(),
      });
    } catch {
      // no-op: client disconnected
    }
  }

  /** Extract a safe { message, details?, code? } from any thrown value. */
  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      return this.fromResponseBody(exception.getResponse(), exception.message);
    }
    if (exception instanceof WsException) {
      const err = exception.getError();
      if (typeof err === 'string') return { message: err };
      return this.fromResponseBody(err, getErrorMessage(exception));
    }
    // Unexpected/non-framework error: never leak internals to the client.
    return { message: 'Internal server error', code: ErrorCode.INTERNAL_ERROR };
  }

  private fromResponseBody(
    body: string | object,
    fallbackMessage: string,
  ): NormalizedError {
    if (typeof body === 'string') return { message: body };

    const record = body as Record<string, unknown>;
    const rawMessage = record.message;
    const code = typeof record.code === 'string' ? record.code : undefined;

    // class-validator surfaces an array of constraint messages.
    if (Array.isArray(rawMessage)) {
      return {
        message: 'Validation failed',
        details: rawMessage,
        code: code ?? ErrorCode.VALIDATION_ERROR,
      };
    }
    if (typeof rawMessage === 'string') return { message: rawMessage, code };
    return { message: fallbackMessage, code };
  }

  private log(
    status: number,
    code: string,
    context: string,
    exception: unknown,
  ): void {
    const line = `${context} -> ${status} ${code}: ${getErrorMessage(exception)}`;
    // 5xx are unexpected/server faults: log with a stack. 4xx are client errors.
    if (status >= 500) {
      this.logger.error(
        line,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.debug(line);
    }
  }
}
