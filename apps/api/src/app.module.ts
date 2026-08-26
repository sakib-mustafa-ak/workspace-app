import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { configuration } from './config/index.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';
import { AppLoggerModule } from './infrastructure/logger/logger.module.js';
import { WorkspaceMembershipGuard } from './common/guards/workspace-membership.guard.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';
import { BoardsModule } from './modules/boards/boards.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { CommentsModule } from './modules/comments/comments.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { ChecklistModule } from './modules/checklists/checklist.module.js';

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

    // Global rate limiting. Default is generous (120 req/min per IP);
    // sensitive routes tighten it with @Throttle(). Single-instance
    // in-memory storage — revisit with a Redis store before scaling
    // horizontally.
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),

    AppLoggerModule,
    DatabaseModule,
    RedisModule,

    HealthModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    BoardsModule,
    TasksModule,
    CommentsModule,
    NotificationsModule,
    RealtimeModule,
    UploadsModule,
    SearchModule,
    AiModule,
    AuditModule,
    ChecklistModule,
  ],
  providers: [
    // Order matters: JwtAuthGuard (registered in AuthModule) authenticates
    // first, then the workspace boundary check, then rate limiting.
    {
      provide: APP_GUARD,
      useClass: WorkspaceMembershipGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
