import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { CREATED_AT } from '../common.js';
import { webhookEventStatusEnum } from '../enums/billing.enums.js';
import { workspaces } from '../workspaces/workspace.schema.js';

import { stripeWebhookEventAlias, stripeWebhookEventsTableName } from './billing.constants.js';

/**
 * Idempotency ledger for Stripe webhook delivery. `id` is Stripe's own
 * event id — safe as PK because Stripe guarantees delivery dedup is the
 * receiving side's job. PROCESSING/FAILED rows are re-processed on retry;
 * COMPLETED rows are skipped.
 */
export const stripeWebhookEvents = pgTable(
  stripeWebhookEventsTableName,
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    status: webhookEventStatusEnum('status').notNull().default('PROCESSING'),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }),
    createdAt: CREATED_AT(),
  },
  (table) => ({
    stripeWebhookEventsWorkspaceIdx: index('stripe_webhook_events_workspace_idx')
      .on(table.workspaceId),
  }),
);

export type StripeWebhookEventRow = typeof stripeWebhookEvents.$inferSelect;
export type NewStripeWebhookEventRow = typeof stripeWebhookEvents.$inferInsert;

export const stripeWebhookEventAccess = {
  table: stripeWebhookEvents,
  alias: stripeWebhookEventAlias,
};
