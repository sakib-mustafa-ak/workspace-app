import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  DATABASE,
  desc,
  eq,
  type Db,
  type PushSubscriptionRow,
  type NewPushSubscriptionRow,
  pushSubscriptions,
} from '@repo/database';

@Injectable()
export class PushSubscriptionsRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async create(
    row: NewPushSubscriptionRow,
  ): Promise<PushSubscriptionRow> {
    const [created] = await this.db
      .insert(pushSubscriptions)
      .values(row)
      .onConflictDoNothing({ target: pushSubscriptions.endpoint })
      .returning();
    return created;
  }

  public async findById(id: string): Promise<PushSubscriptionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.id, id))
      .limit(1);
    return row;
  }

  public async findByEndpoint(
    endpoint: string,
  ): Promise<PushSubscriptionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);
    return row;
  }

  public async listByUser(userId: string): Promise<PushSubscriptionRow[]> {
    return this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))
      .orderBy(desc(pushSubscriptions.createdAt));
  }

  public async deleteById(id: string, userId: string): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(
        and(eq(pushSubscriptions.id, id), eq(pushSubscriptions.userId, userId)),
      );
  }

  public async deleteAllByUser(userId: string): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  }
}
