import { Params } from 'nestjs-pino';
import { LoggerModule } from 'nestjs-pino';
import { IncomingMessage } from 'node:http';
import { Request } from 'express';

/**
 * Centralized HTTP request logger.
 *
 * Why pino?
 * - High throughput, structured output.
 * - Designed for async-friendly production logging.
 * - Plays well with the Nest DI container.
 *
 * Every log line carries contextual metadata (`req.id`, `req.method`,
 * etc.) so consumers (Grafana, Loki, Datadog) can correlate.
 */
export function buildLoggerOptions(isProduction: boolean): Params {
  const httpOptions: Params['pinoHttp'] = {
    customLogLevel: (
      _req: IncomingMessage,
      res: { statusCode: number },
      err: Error | undefined,
    ) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    genReqId: (req: IncomingMessage) => {
      const headerId = (req.headers['x-request-id'] as string | undefined) ?? '';
      return (
        headerId ||
        `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
      );
    },
    customProps: (req: IncomingMessage) => ({
      context: 'HTTP',
      method: req.method,
      path: (req as Request).originalUrl ?? req.url,
    }),
    serializers: {
      req(req: { method: string; url: string; id: string }) {
        return { method: req.method, url: req.url, id: req.id };
      },
      res(res: { statusCode: number }) {
        return { statusCode: res.statusCode };
      },
    },
  };

  if (isProduction) {
    return { pinoHttp: httpOptions };
  }

  return {
    pinoHttp: {
      ...httpOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          singleLine: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname,context',
        },
      },
    },
  };
}

/**
 * Async bootstrap so the factory can read Whether the app is in
 * production from `ConfigService` — `process.env` is never accessed
 * outside `apps/api/src/config`.
 */
export const AppLoggerModule = LoggerModule.forRootAsync({
  inject: ['ConfigService'] as const,
  useFactory: async (
    configService: { get: <T>(key: string) => T | undefined },
  ): Promise<Params> => {
    const isProduction =
      configService.get<string>('app.nodeEnv') === 'production';
    return buildLoggerOptions(Boolean(isProduction));
  },
});
