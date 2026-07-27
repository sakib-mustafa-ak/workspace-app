import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  sql,
  type Db,
  type NewUserRow,
  type UserRow,
  users,
} from '@repo/database';

@Injectable()
export class UsersRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  private readonly publicColumns = {
    id: users.id,
    displayName: users.displayName,
    email: users.email,
    avatarUrl: users.avatarUrl,
    bio: users.bio,
    timezone: users.timezone,
    locale: users.locale,
    status: users.status,
    emailVerifiedAt: users.emailVerifiedAt,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
  } as const;

  public async findById(id: string): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), sql`${users.deletedAt} IS NULL`))
      .limit(1);
    return row;
  }

  public async findByEmail(email: string): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(
        and(
          sql`lower(${users.email}) = lower(${email})`,
          sql`${users.deletedAt} IS NULL`,
        ),
      )
      .limit(1);
    return row;
  }

  public async updateProfile(
    userId: string,
    data: Partial<
      Pick<
        NewUserRow,
        'displayName' | 'avatarUrl' | 'bio' | 'timezone' | 'locale'
      >
    >,
  ): Promise<UserRow> {
    const [updated] = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(users.id, userId), sql`${users.deletedAt} IS NULL`))
      .returning();
    if (!updated) {
      throw new Error('Failed to update user profile.');
    }
    return updated;
  }

  public async softDelete(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  public async list(
    opts: { limit?: number; offset?: number } = {},
  ): Promise<UserRow[]> {
    const { limit = 20, offset = 0 } = opts;
    return this.db
      .select()
      .from(users)
      .where(sql`${users.deletedAt} IS NULL`)
      .orderBy(users.createdAt)
      .limit(limit)
      .offset(offset);
  }

  public async count(): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.deletedAt} IS NULL`);
    return Number(result.count);
  }
}
