import { Inject, Injectable } from '@nestjs/common';
import {
  DATABASE,
  eq,
  sql,
  type Db,
  type UserRow,
  users,
} from '@repo/database';

/**
 * User persistence adapter.
 *
 * Lives in `auth/` because the auth service is the only authorized
 * reader of `passwordHash` and the canonical caller of `updateLastLogin`.
 * The Users module will share this aggregate but its own repository
 * re-exports a password-hash-free view.
 */
@Injectable()
export class UserRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async create(row: {
    displayName: string;
    email: string;
    passwordHash: string;
  }): Promise<UserRow> {
    const [created] = await this.db
      .insert(users)
      .values({
        displayName: row.displayName,
        email: row.email,
        passwordHash: row.passwordHash,
      })
      .returning();
    if (!created) {
      throw new Error('Failed to insert user.');
    }
    return created;
  }

  public async findByIdWithPassword(
    id: string,
    opts: { includeDeleted?: boolean } = {},
  ): Promise<UserRow | undefined> {
    const where = opts.includeDeleted
      ? eq(users.id, id)
      : sql`${users.id} = ${id} AND ${users.deletedAt} IS NULL`;
    const [row] = await this.db
      .select()
      .from(users)
      .where(where)
      .limit(1);
    return row;
  }

  public async findByEmailWithPassword(
    email: string,
  ): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email}) AND ${users.deletedAt} IS NULL`)
      .limit(1);
    return row;
  }

  public async setLastLoginAt(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userId));
  }
}
