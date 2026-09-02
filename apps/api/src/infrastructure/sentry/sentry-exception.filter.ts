import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Request } from 'express';

/**
 * Global Sentry exception filter.
 *
 * Captures every unhandled exception to Sentry, then delegates response
 * formatting to the existing `BusinessExceptionFilter` so client-facing
 * error shapes are unchanged. Event metadata ties the captured exception to
 * the same `request_id` that structured logs carry, so errors and log lines
 * can be correlated in the observability stack.
 *
 * Resolution-wise this filter only makes sense when Sentry is enabled, so it
 * is only registered from `main.ts` when a DSN is configured.
 */
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  constructor(private readonly next: ExceptionFilter) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // Domain/Business exceptions are expected and handled — don't spam Sentry
    // with them. Only capture genuine unexpected failures.
    if (!(exception instanceof HttpException)) {
      const request = host.switchToHttp().getRequest<Request>();
      Sentry.setTag(
        'request_id',
        (request.headers['x-request-id'] as string) ?? '',
      );
      Sentry.setExtra('method', request.method);
      Sentry.setExtra('path', request.url);
      Sentry.captureException(exception);
    }
    try {
      this.next.catch(exception, host);
    } catch (delegationError) {
      this.logger.error(
        'BusinessExceptionFilter failed to handle exception',
        delegationError,
      );
      throw delegationError;
    }
  }
}
