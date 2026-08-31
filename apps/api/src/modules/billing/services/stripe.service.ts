import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { BillingErrorCode, BillingException } from '../errors/billing.errors';
import { type PricedPlan } from '../billing.constants';

@Injectable()
export class StripeService {
  private stripe: Stripe | null = null;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  private client(): Stripe {
    if (this.stripe) return this.stripe;
    const secretKey = this.config.get<string>('billing.stripeSecretKey');
    if (!secretKey) {
      throw new BillingException(
        BillingErrorCode.NOT_CONFIGURED,
        'Stripe is not configured.',
        503,
      );
    }
    this.stripe = new Stripe(secretKey);
    return this.stripe;
  }

  public getPriceId(plan: PricedPlan): string {
    const key =
      plan === 'PRO' ? 'billing.priceProMonthly' : 'billing.priceTeamMonthly';
    const priceId = this.config.get<string>(key);
    if (!priceId) {
      throw new BillingException(
        BillingErrorCode.NOT_CONFIGURED,
        `Missing Stripe price ID for ${plan}.`,
        503,
      );
    }
    return priceId;
  }

  public async createCheckoutSession(params: {
    priceId: string;
    quantity: number;
    customerEmail: string;
    workspaceId: string;
    plan: PricedPlan;
    publicBaseUrl: string;
  }): Promise<Stripe.Checkout.Session> {
    return this.client().checkout.sessions.create({
      mode: 'subscription',
      customer_email: params.customerEmail,
      line_items: [{ price: params.priceId, quantity: params.quantity }],
      metadata: { workspaceId: params.workspaceId, plan: params.plan },
      subscription_data: { metadata: { workspaceId: params.workspaceId } },
      success_url: `${params.publicBaseUrl}/workspaces/${params.workspaceId}?billing=success`,
      cancel_url: `${params.publicBaseUrl}/workspaces/${params.workspaceId}?billing=canceled`,
    });
  }

  public async createPortalSession(params: {
    customer: string;
    returnUrl: string;
  }): Promise<Stripe.BillingPortal.Session> {
    return this.client().billingPortal.sessions.create({
      customer: params.customer,
      return_url: params.returnUrl,
    });
  }

  public constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.config.get<string>(
      'billing.stripeWebhookSecret',
    );
    if (!webhookSecret) {
      throw new BillingException(
        BillingErrorCode.NOT_CONFIGURED,
        'Stripe is not configured.',
        503,
      );
    }
    return this.client().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  }
}
