import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { configuration } from './config/index.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';
import { AppLoggerModule } from './infrastructure/logger/logger.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';

/**
 * Root Nest module.
 *
 * Composition order:
 * 1. ConfigModule — must come first; everyone else either reads typed
 *    configuration or uses an injected service.
 * 2. Logging — wired before modules so early failures still emit.
 * 3. Infrastructure singletons — db/redis are global.
 * 4. Feature modules — added incrementally as they ship.
 *
 * Adding a feature module:
 * - Create the module under `apps/api/src/modules/<name>`.
 * - Export its public token from `module.ts`.
 * - Register it below. Do not edit siblings.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
    }),

    AppLoggerModule,
    DatabaseModule,
    RedisModule,

    HealthModule,
    AuthModule,
  ],
  providers: [
    // Protected-by-default: every route requires a valid JWT unless
    // explicitly marked `@Public()`. This is wired at the application
    // level so feature modules can shift without re-registering.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
