import { Inject, Injectable } from '@nestjs/common';

import {
  DATABASE,
  eq,
  type Db,
  type NewStripeWebhookEventRow,
  type StripeWebhookEventRow,
  stripeWebhookEvents,
} from '@repo/database';

@Injectable()
export class StripeWebhookEventsRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async findById(id: string): Promise<StripeWebhookEventRow | undefined> {
    const [row] = await this.db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.id, id))
      .limit(1);
    return row;
  }

  public async create(row: NewStripeWebhookEventRow): Promise<StripeWebhookEventRow> {
    const [created] = await this.db
      .insert(stripeWebhookEvents)
      .values(row)
      .returning();
    if (!created) throw new Error('Failed to insert stripe webhook event.');
    return created;
  }

  public async setStatus(id: string, status: 'COMPLETED' | 'FAILED'): Promise<void> {
    await this.db
      .update(stripeWebhookEvents)
      .set({ status, processedAt: new Date() })
      .where(eq(stripeWebhookEvents.id, id));
  }
}
