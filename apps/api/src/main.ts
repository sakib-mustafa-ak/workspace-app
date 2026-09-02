import 'reflect-metadata';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { BusinessExceptionFilter } from './common/filters/business-exception.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { RequestContextInterceptor } from './infrastructure/sentry/request-context.interceptor.js';
import { SentryExceptionFilter } from './infrastructure/sentry/sentry-exception.filter.js';
import { initSentry } from './infrastructure/sentry/sentry.init.js';
import {
  API_DEFAULT_VERSION,
  API_PREFIX,
} from './common/constants/api.constants.js';
import * as Sentry from '@sentry/nestjs';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.useBodyParser('json', { limit: '10mb' });

  app.use(helmet());

  const configService = app.get(ConfigService);
  const sentryDsn = configService.get<string>('sentry.dsn');
  initSentry(
    sentryDsn,
    configService.get<string>('app.nodeEnv') ?? 'development',
  );

  const corsOrigins = configService.get<string[]>('app.corsOrigins') ?? [];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.setGlobalPrefix(API_PREFIX);

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_DEFAULT_VERSION,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const businessExceptionFilter = new BusinessExceptionFilter();
  // When Sentry is enabled, capture unexpected failures and delegate response
  // formatting to the business filter so client-facing error shapes are unchanged.
  app.useGlobalFilters(
    sentryDsn
      ? new SentryExceptionFilter(businessExceptionFilter)
      : businessExceptionFilter,
  );
  app.useGlobalInterceptors(
    new RequestContextInterceptor(),
    new ResponseInterceptor(),
  );

  const port = Number(configService.get<number>('app.port') ?? 4000);

  await app.listen(port);

  console.log(`API running at http://localhost:${port}/api/v1`);
}

bootstrap().catch((e) => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(e);
  }
  console.error('BOOTSTRAP FAILED:', e);
  process.exit(1);
});
