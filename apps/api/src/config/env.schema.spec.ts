import { envSchemaWithRefinements } from './env.schema';

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://workspace:workspace123@localhost:5433/workspace',
  JWT_ACCESS_SECRET: '0123456789abcdef',
  JWT_REFRESH_SECRET: '0123456789abcdef0123456789abc',
};

describe('optional workspace plugin configuration', () => {
  it('does not require provider credentials for the rest of the app', () => {
    expect(envSchemaWithRefinements.safeParse(base).success).toBe(true);
  });
  it('validates a supplied encryption key', () => {
    expect(
      envSchemaWithRefinements.safeParse({
        ...base,
        PLUGIN_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
      }).success,
    ).toBe(true);
    expect(
      envSchemaWithRefinements.safeParse({
        ...base,
        PLUGIN_TOKEN_ENCRYPTION_KEY: 'short-key',
      }).success,
    ).toBe(false);
  });
});

describe('production email configuration', () => {
  const gmail = {
    ...base,
    NODE_ENV: 'production',
    MAIL_PROVIDER: 'gmail',
    GMAIL_USER: 'workspace.os.verify@gmail.com',
    GMAIL_CLIENT_ID: 'client-test',
    GMAIL_CLIENT_SECRET: 'secret-test',
    GMAIL_REFRESH_TOKEN: 'refresh-test',
    APP_PUBLIC_BASE_URL: 'https://app.example.com',
  };
  it('accepts Gmail without Resend or a custom domain', () => {
    expect(envSchemaWithRefinements.safeParse(gmail).success).toBe(true);
  });
  it.each([
    'GMAIL_USER',
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REFRESH_TOKEN',
  ])('rejects missing Gmail %s', (key) => {
    expect(
      envSchemaWithRefinements.safeParse({ ...gmail, [key]: '' }).success,
    ).toBe(false);
  });
  it('rejects sender mismatch, malformed users, and local inbox with Gmail', () => {
    for (const override of [
      { MAIL_FROM: 'other@gmail.com' },
      { GMAIL_USER: 'invalid' },
      { NODE_ENV: 'development', DEV_MAIL_INBOX_ENABLED: 'true' },
    ]) {
      expect(
        envSchemaWithRefinements.safeParse({ ...gmail, ...override }).success,
      ).toBe(false);
    }
  });
  const production = {
    ...base,
    NODE_ENV: 'production',
    RESEND_API_KEY: 're_test_only',
    MAIL_FROM: 'Workspace OS <accounts@example.com>',
    APP_PUBLIC_BASE_URL: 'https://workspace.example.com',
  };
  it('accepts a configured production sender and public HTTPS URL', () => {
    expect(envSchemaWithRefinements.safeParse(production).success).toBe(true);
  });
  it.each([
    { RESEND_API_KEY: '' },
    { MAIL_FROM: '' },
    { MAIL_FROM: 'onboarding@resend.dev' },
    { MAIL_FROM: 'Workspace <accounts@example.com' },
    { APP_PUBLIC_BASE_URL: 'http://localhost:3000' },
    { APP_PUBLIC_BASE_URL: 'https://localhost' },
    { APP_PUBLIC_BASE_URL: 'not a url' },
    { APP_PUBLIC_BASE_URL: 'https://app.example.com?token=bad' },
  ])('rejects incomplete or unsafe configuration %j', (override) => {
    expect(
      envSchemaWithRefinements.safeParse({ ...production, ...override })
        .success,
    ).toBe(false);
  });
  it('keeps offline recording available for development and tests', () => {
    expect(envSchemaWithRefinements.safeParse(base).success).toBe(true);
  });
});

describe('development inbox configuration', () => {
  it('defaults to disabled', () => {
    const result = envSchemaWithRefinements.parse(base);
    expect(result.DEV_MAIL_INBOX_ENABLED).toBe('false');
  });
  it('permits explicit development-only recording', () => {
    expect(
      envSchemaWithRefinements.safeParse({
        ...base,
        NODE_ENV: 'development',
        DEV_MAIL_INBOX_ENABLED: 'true',
      }).success,
    ).toBe(true);
  });
  it.each(['test', 'production'])('rejects a local inbox in %s', (NODE_ENV) => {
    expect(
      envSchemaWithRefinements.safeParse({
        ...base,
        NODE_ENV,
        DEV_MAIL_INBOX_ENABLED: 'true',
      }).success,
    ).toBe(false);
  });
  it('rejects mixing real delivery with a local inbox', () => {
    expect(
      envSchemaWithRefinements.safeParse({
        ...base,
        NODE_ENV: 'development',
        RESEND_API_KEY: 're_test_only',
        DEV_MAIL_INBOX_ENABLED: 'true',
      }).success,
    ).toBe(false);
  });
});

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
