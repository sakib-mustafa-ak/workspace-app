import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Commercial plans. FREE is the default tier; PRO and TEAM are billed via
 * Stripe. `null` limits in `PLAN_LIMITS` on the API side mean "unlimited".
 */
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['FREE', 'PRO', 'TEAM']);

export type SubscriptionPlan = (typeof subscriptionPlanEnum.enumValues)[number];

/**
 * Mirror of a Stripe subscription's lifecycle status. A FREE row is always
 * ACTIVE; paid rows track Stripe's states (canceled ⇒ back to FREE plan).
 */
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'ACTIVE',
  'CANCELED',
  'PAST_DUE',
  'UNPAID',
  'TRIALING',
  'INCOMPLETE',
]);

export type SubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number];

/**
 * Idempotency lifecycle for processed Stripe webhook events.
 */
export const webhookEventStatusEnum = pgEnum('stripe_webhook_event_status', [
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);

export type WebhookEventStatus = (typeof webhookEventStatusEnum.enumValues)[number];
