import { BillingRepository } from '../data/billing.repository';
import { StripeWebhookEventsRepository } from '../data/stripe-webhook-events.repository';
import { UsageService } from './usage.service';
import { StripeService } from './stripe.service';
import { AuditService } from '../../audit/services/audit.service';
import { BillingService } from './billing.service';
import { BillingErrorCode } from '../errors/billing.errors';

describe('BillingService', () => {
  let usage: {
    requireWorkspaceRole: jest.Mock;
    countActiveSeats: jest.Mock;
    findOwnerId: jest.Mock;
  };
  let stripe: {
    getPriceId: jest.Mock;
    createCheckoutSession: jest.Mock;
    createPortalSession: jest.Mock;
    constructEvent: jest.Mock;
  };
  let subs: {
    findByWorkspace: jest.Mock;
    findByStripeSubscription: jest.Mock;
    upsertFromStripe: jest.Mock;
    updateStripeData: jest.Mock;
  };
  let events: { findById: jest.Mock; create: jest.Mock; setStatus: jest.Mock };
  let audit: { record: jest.Mock };
  let config: { get: jest.Mock };
  let service: BillingService;

  beforeEach(() => {
    usage = {
      requireWorkspaceRole: jest.fn(),
      countActiveSeats: jest.fn(),
      findOwnerId: jest.fn(),
    };
    stripe = {
      getPriceId: jest.fn(),
      createCheckoutSession: jest.fn(),
      createPortalSession: jest.fn(),
      constructEvent: jest.fn(),
    };
    subs = {
      findByWorkspace: jest.fn(),
      findByStripeSubscription: jest.fn(),
      upsertFromStripe: jest.fn(),
      updateStripeData: jest.fn(),
    };
    events = { findById: jest.fn(), create: jest.fn(), setStatus: jest.fn() };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue('http://localhost:3000') };
    service = new BillingService(
      usage as unknown as UsageService,
      stripe as unknown as StripeService,
      subs as unknown as BillingRepository,
      events as unknown as StripeWebhookEventsRepository,
      audit as unknown as AuditService,
      config as unknown as never,
    );
  });

  describe('checkout', () => {
    it('requires ADMIN role and passes the seat count as quantity', async () => {
      usage.requireWorkspaceRole.mockResolvedValue(undefined);
      usage.countActiveSeats.mockResolvedValue(2);
      stripe.getPriceId.mockReturnValue('price_pro');
      stripe.createCheckoutSession.mockResolvedValue({ url: 'https://c' });
      const res = await service.checkout('ws-1', 'u-1', 'a@b.com', 'PRO');
      expect(usage.requireWorkspaceRole).toHaveBeenCalledWith(
        'ws-1',
        'u-1',
        'ADMIN',
      );
      expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          priceId: 'price_pro',
          quantity: 2,
          customerEmail: 'a@b.com',
          workspaceId: 'ws-1',
          plan: 'PRO',
        }),
      );
      expect(res).toEqual({ url: 'https://c' });
    });

    it('rejects an unknown plan with PLAN_NOT_FOUND', async () => {
      await expect(
        service.checkout('ws-1', 'u-1', 'a@b.com', 'FREE' as never),
      ).rejects.toMatchObject({ code: BillingErrorCode.PLAN_NOT_FOUND });
    });

    it('never lets quantity drop below 1', async () => {
      usage.requireWorkspaceRole.mockResolvedValue(undefined);
      usage.countActiveSeats.mockResolvedValue(0);
      stripe.getPriceId.mockReturnValue('price_team');
      stripe.createCheckoutSession.mockResolvedValue({ url: 'https://c' });
      await service.checkout('ws-1', 'u-1', 'a@b.com', 'TEAM');
      const firstCheckoutCall = stripe.createCheckoutSession.mock.calls[0] as {
        quantity?: number;
      }[];
      expect(firstCheckoutCall[0].quantity).toBe(1);
    });
  });

  describe('portal', () => {
    it('requires a linked customer, else NO_CUSTOMER', async () => {
      usage.requireWorkspaceRole.mockResolvedValue(undefined);
      subs.findByWorkspace.mockResolvedValue({
        stripeCustomerId: null,
      } as never);
      await expect(service.portal('ws-1', 'u-1')).rejects.toMatchObject({
        code: BillingErrorCode.NO_CUSTOMER,
      });
    });
    it('creates a portal session for the linked customer', async () => {
      usage.requireWorkspaceRole.mockResolvedValue(undefined);
      subs.findByWorkspace.mockResolvedValue({
        stripeCustomerId: 'cus_1',
      } as never);
      stripe.createPortalSession.mockResolvedValue({ url: 'https://b' });
      const res = await service.portal('ws-1', 'u-1');
      expect(stripe.createPortalSession).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_1' }),
      );
      expect(res).toEqual({ url: 'https://b' });
    });
  });

  describe('handleWebhook (idempotency)', () => {
    it('returns received immediately for an already-completed event', async () => {
      stripe.constructEvent.mockReturnValue({ id: 'evt_1' } as never);
      events.findById.mockResolvedValue({
        id: 'evt_1',
        status: 'COMPLETED',
      } as never);
      const res = await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(events.create).not.toHaveBeenCalled();
      expect(res).toEqual({ received: true });
    });

    it('processes a new checkout.session.completed and audits the change', async () => {
      events.findById.mockResolvedValue(undefined);
      events.create.mockResolvedValue({ id: 'evt_1' } as never);
      usage.findOwnerId.mockResolvedValue('owner-1');
      subs.upsertFromStripe.mockResolvedValue({} as never);
      stripe.constructEvent.mockReturnValue({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { workspaceId: 'ws-1', plan: 'PRO' },
            customer: 'cus_1',
            subscription: 'sub_1',
            status: 'complete',
          },
        },
      });
      const res = await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(subs.upsertFromStripe).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          plan: 'PRO',
          status: 'ACTIVE',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'billing.subscription_changed',
          workspaceId: 'ws-1',
          userId: 'owner-1',
        }),
      );
      expect(events.setStatus).toHaveBeenCalledWith('evt_1', 'COMPLETED');
      expect(res).toEqual({ received: true });
    });

    it('marks FAILED and rethrows when applying the event fails', async () => {
      events.findById.mockResolvedValue(undefined);
      events.create.mockResolvedValue({ id: 'evt_1' } as never);
      const boom = new Error('apply failed');
      stripe.constructEvent.mockReturnValue({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: { object: { metadata: { workspaceId: 'ws-1', plan: 'PRO' } } },
      });
      subs.upsertFromStripe.mockRejectedValue(boom);
      await expect(
        service.handleWebhook(Buffer.from('{}'), 'sig'),
      ).rejects.toBe(boom);
      expect(events.setStatus).toHaveBeenCalledWith('evt_1', 'FAILED');
    });

    it('downgrades to FREE on subscription.canceled', async () => {
      events.findById.mockResolvedValue(undefined);
      events.create.mockResolvedValue({ id: 'evt_2' } as never);
      usage.findOwnerId.mockResolvedValue('owner-1');
      subs.findByStripeSubscription.mockResolvedValue({
        id: 'row-1',
        workspaceId: 'ws-1',
        plan: 'PRO',
      } as never);
      subs.updateStripeData.mockResolvedValue({} as never);
      stripe.constructEvent.mockReturnValue({
        id: 'evt_2',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_1',
            status: 'canceled',
            current_period_start: 1700000000,
            current_period_end: 1702592000,
            canceled_at: 1700100000,
          },
        },
      });
      await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(subs.updateStripeData).toHaveBeenCalledWith(
        'row-1',
        expect.objectContaining({ status: 'CANCELED', plan: 'FREE' }),
      );
      const firstRecordCall = audit.record.mock.calls[0] as [
        { metadata?: { plan?: string; status?: string } },
      ];
      expect(firstRecordCall[0].metadata).toMatchObject({
        plan: 'FREE',
        status: 'CANCELED',
      });
    });
  });
});
