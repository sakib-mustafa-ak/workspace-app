import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  sql,
  type Db,
  type DbExecutor,
  type NewWorkspaceSubscriptionRow,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type WorkspaceSubscriptionRow,
  workspaces,
  workspaceSubscriptions,
} from '@repo/database';

@Injectable()
export class BillingRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async findByWorkspace(
    workspaceId: string,
  ): Promise<WorkspaceSubscriptionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(workspaceSubscriptions)
      .where(eq(workspaceSubscriptions.workspaceId, workspaceId))
      .limit(1);
    return row;
  }

  public async findByStripeSubscription(
    stripeSubscriptionId: string,
  ): Promise<WorkspaceSubscriptionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(workspaceSubscriptions)
      .where(
        eq(workspaceSubscriptions.stripeSubscriptionId, stripeSubscriptionId),
      )
      .limit(1);
    return row;
  }

  public async findPlansByOwner(userId: string): Promise<SubscriptionPlan[]> {
    const rows = await this.db
      .select({ plan: workspaceSubscriptions.plan })
      .from(workspaceSubscriptions)
      .innerJoin(
        workspaces,
        eq(workspaces.id, workspaceSubscriptions.workspaceId),
      )
      .where(
        and(
          eq(workspaces.ownerId, userId),
          sql`${workspaces.deletedAt} IS NULL`,
        ),
      );
    return rows.map((r) => r.plan);
  }

  public async createFree(
    workspaceId: string,
    tx?: DbExecutor,
  ): Promise<WorkspaceSubscriptionRow | undefined> {
    const exec = tx ?? this.db;
    const row: NewWorkspaceSubscriptionRow = {
      workspaceId,
      plan: 'FREE',
      status: 'ACTIVE',
    };
    const [created] = await exec
      .insert(workspaceSubscriptions)
      .values(row)
      .onConflictDoNothing()
      .returning();
    return created;
  }

  public async upsertFromStripe(
    data: {
      workspaceId: string;
      plan: SubscriptionPlan;
      status: SubscriptionStatus;
      stripeCustomerId?: string | null;
      stripeSubscriptionId?: string | null;
      currentPeriodStart?: Date | null;
      currentPeriodEnd?: Date | null;
    },
  ): Promise<WorkspaceSubscriptionRow> {
    const [row] = await this.db
      .insert(workspaceSubscriptions)
      .values({
        workspaceId: data.workspaceId,
        plan: data.plan,
        status: data.status,
        stripeCustomerId: data.stripeCustomerId ?? null,
        stripeSubscriptionId: data.stripeSubscriptionId ?? null,
        currentPeriodStart: data.currentPeriodStart ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
      })
      .onConflictDoUpdate({
        target: workspaceSubscriptions.workspaceId,
        set: {
          plan: data.plan,
          status: data.status,
          stripeCustomerId: data.stripeCustomerId ?? null,
          stripeSubscriptionId: data.stripeSubscriptionId ?? null,
          currentPeriodStart: data.currentPeriodStart ?? null,
          currentPeriodEnd: data.currentPeriodEnd ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error('Failed to upsert workspace subscription.');
    return row;
  }

  public async updateStripeData(
    id: string,
    data: {
      status: SubscriptionStatus;
      plan?: SubscriptionPlan;
      currentPeriodStart?: Date | null;
      currentPeriodEnd?: Date | null;
      canceledAt?: Date | null;
    },
  ): Promise<WorkspaceSubscriptionRow> {
    const [row] = await this.db
      .update(workspaceSubscriptions)
      .set({
        status: data.status,
        ...(data.plan !== undefined ? { plan: data.plan } : {}),
        ...(data.currentPeriodStart !== undefined
          ? { currentPeriodStart: data.currentPeriodStart }
          : {}),
        ...(data.currentPeriodEnd !== undefined
          ? { currentPeriodEnd: data.currentPeriodEnd }
          : {}),
        ...(data.canceledAt !== undefined
          ? { canceledAt: data.canceledAt }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(workspaceSubscriptions.id, id))
      .returning();
    if (!row) throw new Error('Failed to update workspace subscription.');
    return row;
  }
}
