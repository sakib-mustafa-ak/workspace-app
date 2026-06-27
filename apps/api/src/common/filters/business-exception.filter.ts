import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global filter that translates every thrown exception into the
 * standardized error response envelope.
 *
 * Why global?
 * - Ensures the API never leaks internal details.
 * - Keeps error shapes stable for clients.
 * - Avoids repeating try/catch boilerplate in controllers.
 */
@Catch()
export class BusinessExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(BusinessExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // HttpException (and our BusinessException which extends it) carries
    // both a stable code and an HTTP status.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const code =
        typeof body === 'object' && body !== null && 'code' in body
          ? String((body as { code: unknown }).code)
          : defaultCodeForStatus(status);
      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? String((body as { message: unknown }).message)
          : exception.message;

      response.status(status).json({
        success: false,
        message,
        error: { code },
        path: request.url,
      });
      return;
    }

    // Unexpected errors are logged with context but do not leak details
    // to the caller — the response is a generic 500.
    this.logger.error(
      { err: exception, path: request.url, method: request.method },
      'Unhandled exception',
    );

    response.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: { code: 'INTERNAL_ERROR' },
      path: request.url,
    });
  }
}

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'VALIDATION_FAILED';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'UNPROCESSABLE_ENTITY';
    default:
      return 'ERROR';
  }
}
