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
