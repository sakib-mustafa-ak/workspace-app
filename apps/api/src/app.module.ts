import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { configuration } from './config/index.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';
import { AppLoggerModule } from './infrastructure/logger/logger.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';

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
 *
 * Note on APP_GUARD placement: NestJS resolves APP_GUARD-injected
 * guards in the module where they are declared; declaring the guard
 * here would mean TokenService / UserRepository (which live in
 * AuthModule) become "unknown dependencies". AuthModule registers
 * APP_GUARD itself so the guard's constructor resolves inside the
 * auth scope.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // The single source of truth for environment lives at the
      // workspace root (.env) — picked up here explicitly because
      // the API's CWD is apps/api, two levels deep.
      envFilePath: ['../../.env'],
      load: [configuration],
    }),

    AppLoggerModule,
    DatabaseModule,
    RedisModule,

    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
