import { Global, Module } from '@nestjs/common';

/**
 * Placeholder Redis module.
 *
 * The Redis client is intentionally deferred until a feature actually
 * needs cache, presence, pub/sub or background-job primitives. Adding
 * the connection eagerly would couple startup time and fragility (the
 * app would refuse to boot when Redis is briefly unreachable).
 *
 * When introduced, this module will:
 * - export `RedisService` as a global provider
 * - read connection settings via `ConfigService` only
 * - keep ioredis inside `infrastructure/redis/`
 *
 * Until then, importing this module is a no-op.
 */
@Global()
@Module({})
export class RedisModule {}
