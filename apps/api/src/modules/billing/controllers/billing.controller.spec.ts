import { Test } from '@nestjs/testing';

import { BillingService } from '../services/billing.service';
import { BillingController } from './billing.controller';
import { WorkspaceSubscriptionController } from './workspace-subscription.controller';
import { UsageService } from '../services/usage.service';

describe('BillingController', () => {
  let controller: BillingController;
  let billing: {
    checkout: jest.Mock;
    portal: jest.Mock;
    handleWebhook: jest.Mock;
  };

  beforeEach(async () => {
    billing = {
      checkout: jest.fn(),
      portal: jest.fn(),
      handleWebhook: jest.fn(),
    };
    const module = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [{ provide: BillingService, useValue: billing }],
    }).compile();
    controller = module.get(BillingController);
  });

  const user = { id: 'u-1', email: 'a@b.com' } as never;

  it('POST /billing/checkout delegates to billing.checkout and returns the URL', async () => {
    billing.checkout.mockResolvedValue({
      url: 'https://checkout.stripe.com/xyz',
    });
    const res = await controller.checkout(user, {
      workspaceId: 'ws-1',
      plan: 'PRO',
    });
    expect(billing.checkout).toHaveBeenCalledWith(
      'ws-1',
      'u-1',
      'a@b.com',
      'PRO',
    );
    expect(res).toEqual({ url: 'https://checkout.stripe.com/xyz' });
  });

  it('POST /billing/portal delegates to billing.portal', async () => {
    billing.portal.mockResolvedValue({
      url: 'https://billing.stripe.com/p/xyz',
    });
    const res = await controller.portal(user, { workspaceId: 'ws-1' });
    expect(billing.portal).toHaveBeenCalledWith('ws-1', 'u-1');
    expect(res).toEqual({ url: 'https://billing.stripe.com/p/xyz' });
  });

  it('POST /billing/webhook rejects a missing signature', async () => {
    await expect(
      controller.webhook({ headers: {}, rawBody: Buffer.from('{}') } as never),
    ).rejects.toMatchObject({
      code: 'BILLING.WEBHOOK_INVALID',
    });
  });

  it('POST /billing/webhook forwards raw body + signature and returns received', async () => {
    billing.handleWebhook.mockResolvedValue({ received: true });
    const req = {
      headers: { 'stripe-signature': 'sig123' },
      rawBody: Buffer.from('{"k":1}'),
    };
    const res = await controller.webhook(req as never);
    expect(billing.handleWebhook).toHaveBeenCalledWith(
      Buffer.from('{"k":1}'),
      'sig123',
    );
    expect(res).toEqual({ received: true });
  });
});

describe('WorkspaceSubscriptionController', () => {
  let controller: WorkspaceSubscriptionController;
  let usage: { getSubscriptionView: jest.Mock };

  beforeEach(async () => {
    usage = { getSubscriptionView: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [WorkspaceSubscriptionController],
      providers: [{ provide: UsageService, useValue: usage }],
    }).compile();
    controller = module.get(WorkspaceSubscriptionController);
  });

  it('GET /workspaces/:workspaceId/subscription returns the view', async () => {
    usage.getSubscriptionView.mockResolvedValue({
      workspaceId: 'ws-1',
      plan: 'PRO',
      status: 'ACTIVE',
      currentPeriodEnd: null,
    });
    const res = await controller.getSubscription('ws-1');
    expect(usage.getSubscriptionView).toHaveBeenCalledWith('ws-1');
    expect(res.plan).toBe('PRO');
  });
});
