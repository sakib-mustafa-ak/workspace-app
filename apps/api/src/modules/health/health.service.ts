import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE, sql, type Db } from '@repo/database';

export interface IntegrationCheck {
  name: string;
  configured: boolean;
  provider: string;
}

export interface DatabaseCheck {
  status: 'up' | 'down';
  latencyMs: number | null;
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  checks: {
    database: DatabaseCheck;
    integrations: IntegrationCheck[];
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  /** Liveness — always resolves so uptime monitors report the process is up. */
  public async getHealth(): Promise<HealthResponse> {
    const base = {
      status: 'ok' as const,
      service: 'workspace-api',
      version: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
    const database = await this.checkDatabase();
    const integrations = this.checkIntegrations();
    return {
      ...base,
      checks: { database, integrations },
    };
  }

  private async checkDatabase(): Promise<DatabaseCheck> {
    const started = Date.now();
    try {
      await Promise.race([
        this.db.execute(sql`select 1`),
        // Never let a hung connection stall the liveness probe.
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('database ping timed out')), 2000),
        ),
      ]);
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (err) {
      this.logger.error({ err: String(err) }, 'Database health check failed');
      return { status: 'down', latencyMs: null };
    }
  }

  private checkIntegrations(): IntegrationCheck[] {
    const storageDriver = this.config.get<string>('storage.driver');
    const resendKey = this.config.get<string>('RESEND_API_KEY');
    const stripeKey = this.config.get<string>('billing.stripeSecretKey');

    return [
      {
        name: 'storage',
        configured: storageDriver !== 'local',
        provider: storageDriver ?? 'local',
      },
      {
        name: 'email',
        configured: Boolean(resendKey),
        provider: resendKey ? 'resend' : 'recorder',
      },
      {
        name: 'billing',
        configured: Boolean(stripeKey),
        provider: stripeKey ? 'stripe' : 'not configured',
      },
    ];
  }
}
