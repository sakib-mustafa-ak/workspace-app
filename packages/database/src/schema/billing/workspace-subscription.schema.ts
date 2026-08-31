import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { CREATED_AT, PRIMARY_ID, UPDATED_AT } from '../common.js';
import { subscriptionPlanEnum, subscriptionStatusEnum } from '../enums/billing.enums.js';
import { workspaces } from '../workspaces/workspace.schema.js';

import { workspaceSubscriptionAlias, workspaceSubscriptionsTableName } from './billing.constants.js';

/**
 * One billing row per workspace. The row is created FREE/ACTIVE when a
 * workspace is created (and backfilled for pre-existing workspaces by the
 * migration). Stripe webhooks upsert this row; the app never writes plan
 * changes directly.
 */
export const workspaceSubscriptions = pgTable(
  workspaceSubscriptionsTableName,
  {
    id: PRIMARY_ID(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .unique()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    plan: subscriptionPlanEnum('plan').notNull().default('FREE'),
    status: subscriptionStatusEnum('status').notNull().default('ACTIVE'),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true, mode: 'date' }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true, mode: 'date' }),
    canceledAt: timestamp('canceled_at', { withTimezone: true, mode: 'date' }),
    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
  },
  (table) => ({
    workspaceSubscriptionsWorkspaceUnique: uniqueIndex('workspace_subscriptions_workspace_unique')
      .on(table.workspaceId),
    workspaceSubscriptionsStripeSubIdx: index('workspace_subscriptions_stripe_sub_idx')
      .on(table.stripeSubscriptionId),
  }),
);

export type WorkspaceSubscriptionRow = typeof workspaceSubscriptions.$inferSelect;
export type NewWorkspaceSubscriptionRow = typeof workspaceSubscriptions.$inferInsert;

export const workspaceSubscriptionAccess = {
  table: workspaceSubscriptions,
  alias: workspaceSubscriptionAlias,
};
