import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  inArray,
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
    opts: {
      limit?: number;
      offset?: number;
      search?: string;
      sortBy?: 'displayName' | 'email' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
      ids?: string[];
    } = {},
  ): Promise<UserRow[]> {
    const { limit = 20, offset = 0 } = opts;
    const conditions = [sql`${users.deletedAt} IS NULL`];
    if (opts.ids && opts.ids.length > 0) {
      conditions.push(inArray(users.id, opts.ids));
    }
    if (opts.search) {
      const like = `%${opts.search.toLowerCase()}%`;
      conditions.push(
        sql`(lower(${users.displayName}) LIKE ${like} OR lower(${users.email}) LIKE ${like})`,
      );
    }
    const sortColumn =
      opts.sortBy === 'displayName'
        ? users.displayName
        : opts.sortBy === 'email'
          ? users.email
          : users.createdAt;
    const order = opts.sortOrder === 'desc' ? 'desc' : 'asc';
    return this.db
      .select()
      .from(users)
      .where(and(...conditions))
      .orderBy(
        order === 'desc' ? sql`${sortColumn} desc` : sql`${sortColumn} asc`,
      )
      .limit(limit)
      .offset(offset);
  }

  public async countFiltered(search?: string, ids?: string[]): Promise<number> {
    const conditions = [sql`${users.deletedAt} IS NULL`];
    if (ids && ids.length > 0) {
      conditions.push(inArray(users.id, ids));
    }
    if (search) {
      const like = `%${search.toLowerCase()}%`;
      conditions.push(
        sql`(lower(${users.displayName}) LIKE ${like} OR lower(${users.email}) LIKE ${like})`,
      );
    }
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(...conditions));
    return Number(result.count);
  }

  public async count(): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.deletedAt} IS NULL`);
    return Number(result.count);
  }
}
