import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DATABASE } from '@repo/database';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  const db = { execute: jest.fn() };
  const config = { get: jest.fn() };

  async function createService() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: DATABASE, useValue: db },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get<HealthService>(HealthService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', async () => {
    await createService();
    expect(service).toBeDefined();
  });

  it('reports the database as up when the ping succeeds', async () => {
    db.execute.mockResolvedValueOnce([]);
    config.get.mockImplementation((key: string) => {
      if (key === 'storage.driver') return 's3';
      if (key === 'billing.stripeSecretKey') return 'secret';
      if (key === 'RESEND_API_KEY') return 'key';
      return undefined;
    });
    await createService();

    const health = await service.getHealth();
    expect(health.status).toBe('ok');
    expect(health.checks.database.status).toBe('up');
    expect(health.checks.database.latencyMs).toEqual(expect.any(Number));
  });

  it('reports the database as down when the ping fails without throwing', async () => {
    db.execute.mockRejectedValueOnce(new Error('connection refused'));
    await createService();

    const health = await service.getHealth();
    expect(health.status).toBe('ok');
    expect(health.checks.database.status).toBe('down');
    expect(health.checks.database.latencyMs).toBeNull();
  });

  it('reports storage as not configured when using the local driver', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'storage.driver') return 'local';
      return undefined;
    });
    await createService();

    const health = await service.getHealth();
    const storage = health.checks.integrations.find(
      (i) => i.name === 'storage',
    );
    expect(storage?.configured).toBe(false);
    expect(storage?.provider).toBe('local');
  });

  it('reports billing and email as configured vs fallback', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'storage.driver') return 'vercel-blob';
      if (key === 'RESEND_API_KEY') return 'key';
      if (key === 'billing.stripeSecretKey') return undefined;
      return undefined;
    });
    await createService();

    const health = await service.getHealth();
    const byName = Object.fromEntries(
      health.checks.integrations.map((i) => [i.name, i]),
    );
    expect(byName.email.configured).toBe(true);
    expect(byName.email.provider).toBe('resend');
    expect(byName.billing.configured).toBe(false);
    expect(byName.billing.provider).toBe('not configured');
  });
});
