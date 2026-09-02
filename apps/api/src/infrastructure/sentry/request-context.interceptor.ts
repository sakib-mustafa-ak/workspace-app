import { Injectable } from '@nestjs/common';
import {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common/interfaces';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import * as Sentry from '@sentry/nestjs';

/**
 * Ensures every request carries a stable, echoable request id and ties the
 * current server-side event to that id for Sentry correlation.
 *
 * The id defaults to the same scheme pino's `genReqId` uses, so a request
 * logged by pino and an error captured by Sentry share one `request_id`.
 * The id is also echoed back in the `x-request-id` response header so the
 * web client can surface it in support contacts.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    let id = req.headers['x-request-id'] as string | undefined;
    if (!id) {
      id = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      req.headers['x-request-id'] = id;
    }
    res.setHeader('x-request-id', id);
    Sentry.setTag('request_id', id);

    return next.handle();
  }
}
