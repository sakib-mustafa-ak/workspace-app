import { envSchemaWithRefinements } from './env.schema';

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://workspace:workspace123@localhost:5433/workspace',
  JWT_ACCESS_SECRET: '0123456789abcdef',
  JWT_REFRESH_SECRET: '0123456789abcdef0123456789abc',
};

describe('env schema billing', () => {
  it('accepts a fully-configured Stripe environment', () => {
    const res = envSchemaWithRefinements.safeParse({
      ...base,
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
      STRIPE_PRICE_PRO_MONTHLY: 'price_pro',
      STRIPE_PRICE_TEAM_MONTHLY: 'price_team',
    });
    expect(res.success).toBe(true);
  });

  it('accepts a Stripe-free environment (billing is optional)', () => {
    const res = envSchemaWithRefinements.safeParse(base);
    expect(res.success).toBe(true);
  });

  it('REJECTS a secret key without a webhook secret at boot', () => {
    const res = envSchemaWithRefinements.safeParse({
      ...base,
      STRIPE_SECRET_KEY: 'sk_test_123',
    });
    expect(res.success).toBe(false);
  });
});

describe('env schema vercel-blob storage', () => {
  it('REJECTS vercel-blob driver without a read-write token at boot', () => {
    const res = envSchemaWithRefinements.safeParse({
      ...base,
      STORAGE_DRIVER: 'vercel-blob',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(
        res.error.issues.some((i) => i.path[0] === 'BLOB_READ_WRITE_TOKEN'),
      ).toBe(true);
    }
  });

  it('accepts vercel-blob driver with a read-write token', () => {
    const res = envSchemaWithRefinements.safeParse({
      ...base,
      STORAGE_DRIVER: 'vercel-blob',
      BLOB_READ_WRITE_TOKEN: 'blob_rw_123',
    });
    expect(res.success).toBe(true);
  });

  it('still defaults to local and accepts s3 unchanged', () => {
    const local = envSchemaWithRefinements.safeParse(base);
    expect(local.success).toBe(true);
    if (local.success) expect(local.data.STORAGE_DRIVER).toBe('local');

    const s3 = envSchemaWithRefinements.safeParse({
      ...base,
      STORAGE_DRIVER: 's3',
      S3_ENDPOINT: 'https://bucket.r2.cloudflarestorage.com',
      S3_REGION: 'auto',
      S3_BUCKET: 'uploads',
      S3_ACCESS_KEY_ID: 'k',
      S3_SECRET_ACCESS_KEY: 's',
    });
    expect(s3.success).toBe(true);
  });
});
