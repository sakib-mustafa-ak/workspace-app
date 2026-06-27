import 'reflect-metadata';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { BusinessExceptionFilter } from './common/filters/business-exception.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { API_DEFAULT_VERSION, API_PREFIX } from './common/constants/api.constants.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(helmet());
  app.enableCors();

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

  // Swagger is mounted under /docs so it never conflicts with the
  // versioned API and stays excluded from the production URL surface.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Workspace OS API')
    .setDescription('Modular monolith API for the Workspace OS platform.')
    .setVersion(process.env.npm_package_version ?? '0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const configService = app.get(ConfigService);
  const port = Number(configService.get<number>('app.port') ?? 4000);

  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`🚀 API running at http://localhost:${port}/api/v1`);
}

void bootstrap();
