import 'reflect-metadata';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { BusinessExceptionFilter } from './common/filters/business-exception.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import {
  API_DEFAULT_VERSION,
  API_PREFIX,
} from './common/constants/api.constants.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.useBodyParser('json', { limit: '10mb' });

  app.use(helmet());

  const configService = app.get(ConfigService);
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

  app.useGlobalFilters(new BusinessExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = Number(configService.get<number>('app.port') ?? 4000);

  await app.listen(port);

  console.log(`API running at http://localhost:${port}/api/v1`);
}

bootstrap().catch((e) => {
  console.error('BOOTSTRAP FAILED:', e);
  process.exit(1);
});
