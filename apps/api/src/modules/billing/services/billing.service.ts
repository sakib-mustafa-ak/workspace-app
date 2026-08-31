import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import type { SubscriptionPlan } from '@repo/database';

import { AuditService } from '../../audit/services/audit.service';
import { BillingRepository } from '../data/billing.repository';
import { StripeWebhookEventsRepository } from '../data/stripe-webhook-events.repository';
import { BillingErrorCode, BillingException } from '../errors/billing.errors';
import { isPricedPlan, type PricedPlan } from '../billing.constants';
import { StripeService } from './stripe.service';
import { UsageService } from './usage.service';

@Injectable()
export class BillingService {
  constructor(
    @Inject(UsageService) private readonly usage: UsageService,
    @Inject(StripeService) private readonly stripe: StripeService,
    @Inject(BillingRepository) private readonly subs: BillingRepository,
    @Inject(StripeWebhookEventsRepository)
    private readonly events: StripeWebhookEventsRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  public async checkout(
    workspaceId: string,
    userId: string,
    customerEmail: string,
    plan: PricedPlan,
  ): Promise<{ url: string }> {
    if (!isPricedPlan(plan)) {
      throw new BillingException(
        BillingErrorCode.PLAN_NOT_FOUND,
        'Unknown plan.',
        400,
      );
    }
    await this.usage.requireWorkspaceRole(workspaceId, userId, 'ADMIN');
    const priceId = this.stripe.getPriceId(plan);
    const seats = Math.max(1, await this.usage.countActiveSeats(workspaceId));
    const publicBaseUrl =
      this.config.get<string>('app.publicBaseUrl') ?? 'http://localhost:3000';
    const session = await this.stripe.createCheckoutSession({
      priceId,
      quantity: seats,
      customerEmail,
      workspaceId,
      plan,
      publicBaseUrl,
    });
    if (!session.url) {
      throw new BillingException(
        BillingErrorCode.NOT_CONFIGURED,
        'Stripe did not return a checkout URL.',
        503,
      );
    }
    return { url: session.url };
  }

  public async portal(
    workspaceId: string,
    userId: string,
  ): Promise<{ url: string }> {
    await this.usage.requireWorkspaceRole(workspaceId, userId, 'ADMIN');
    const sub = await this.subs.findByWorkspace(workspaceId);
    if (!sub?.stripeCustomerId) {
      throw new BillingException(
        BillingErrorCode.NO_CUSTOMER,
        'No Stripe customer is linked to this workspace yet.',
        409,
      );
    }
    const publicBaseUrl =
      this.config.get<string>('app.publicBaseUrl') ?? 'http://localhost:3000';
    const session = await this.stripe.createPortalSession({
      customer: sub.stripeCustomerId,
      returnUrl: `${publicBaseUrl}/workspaces/${workspaceId}?billing=manage`,
    });
    return { url: session.url };
  }

  public async handleWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: true }> {
    const event = this.stripe.constructEvent(rawBody, signature);

    const existing = await this.events.findById(event.id);
    if (existing?.status === 'COMPLETED') return { received: true };

    if (!existing) {
      await this.events.create({
        id: event.id,
        type: event.type,
        payload:
          (event.data.object as unknown as Record<string, unknown>) ?? {},
        status: 'PROCESSING',
      });
    }

    try {
      await this.applyEvent(event);
      await this.events.setStatus(event.id, 'COMPLETED');
    } catch (err) {
      try {
        await this.events.setStatus(event.id, 'FAILED');
      } catch {
        // never mask the original apply error with a ledger-write failure
      }
      throw err;
    }
    return { received: true };
  }

  private async applyEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        return;
      case 'customer.subscription.updated':
        await this.handleSubscriptionChanged(event.data.object);
        return;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        return;
      default:
        return;
    }
  }

  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const workspaceId = session.metadata?.workspaceId;
    const plan = session.metadata?.plan;
    if (!workspaceId || !isPricedPlan(plan)) return; // unrelated/legacy event — skip silently

    await this.subs.upsertFromStripe({
      workspaceId,
      plan,
      status: 'ACTIVE',
      stripeCustomerId:
        typeof session.customer === 'string' ? session.customer : null,
      stripeSubscriptionId:
        typeof session.subscription === 'string' ? session.subscription : null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
    });

    await this.recordChange(
      workspaceId,
      plan,
      'ACTIVE',
      eventTypeToLabel('checkout.session.completed'),
    );
  }

  private async handleSubscriptionChanged(
    sub: Stripe.Subscription,
  ): Promise<void> {
    const row = await this.subs.findByStripeSubscription(sub.id);
    if (!row) return;

    const canceled = sub.status === 'canceled';
    const status = mapSubscriptionStatus(sub.status);
    const plan: SubscriptionPlan = canceled ? 'FREE' : row.plan;

    await this.subs.updateStripeData(row.id, {
      status,
      plan,
      currentPeriodStart:
        sub.status === 'canceled'
          ? null
          : sub.items.data[0]?.current_period_start
            ? new Date(sub.items.data[0].current_period_start * 1000)
            : null,
      currentPeriodEnd:
        sub.status === 'canceled'
          ? null
          : sub.items.data[0]?.current_period_end
            ? new Date(sub.items.data[0].current_period_end * 1000)
            : null,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    });

    await this.recordChange(
      row.workspaceId,
      plan,
      status,
      eventTypeToLabel('customer.subscription.updated'),
    );
  }

  private async handleSubscriptionDeleted(
    sub: Stripe.Subscription,
  ): Promise<void> {
    const row = await this.subs.findByStripeSubscription(sub.id);
    if (!row) return;

    await this.subs.updateStripeData(row.id, {
      status: 'CANCELED',
      plan: 'FREE',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      canceledAt: new Date(),
    });

    await this.recordChange(
      row.workspaceId,
      'FREE',
      'CANCELED',
      eventTypeToLabel('customer.subscription.deleted'),
    );
  }

  private async recordChange(
    workspaceId: string,
    plan: SubscriptionPlan,
    status: string,
    source: string,
  ): Promise<void> {
    const userId = await this.usage.findOwnerId(workspaceId);
    if (!userId) return;
    await this.audit.record({
      workspaceId,
      userId,
      action: 'billing.subscription_changed',
      resourceType: 'subscription',
      resourceId: workspaceId,
      metadata: { plan, status, source },
    });
  }
}

function eventTypeToLabel(type: string): string {
  switch (type) {
    case 'checkout.session.completed':
      return 'checkout.session.completed';
    case 'customer.subscription.updated':
      return 'customer.subscription.updated';
    case 'customer.subscription.deleted':
      return 'customer.subscription.deleted';
    default:
      return type;
  }
}

function mapSubscriptionStatus(
  status: Stripe.Subscription.Status,
): 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'UNPAID' | 'TRIALING' | 'INCOMPLETE' {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'unpaid':
      return 'UNPAID';
    case 'trialing':
      return 'TRIALING';
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELED';
    default:
      return 'INCOMPLETE';
  }
}
