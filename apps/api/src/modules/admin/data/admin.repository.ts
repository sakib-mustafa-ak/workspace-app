import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  or,
  sql,
  type Db,
  users,
  type WorkspaceRow,
  workspaces,
} from '@repo/database';

const ADMIN_USER_COLUMNS = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
  status: users.status,
  emailVerifiedAt: users.emailVerifiedAt,
  lastLoginAt: users.lastLoginAt,
  isAdmin: users.isAdmin,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

export type AdminUserView = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AdminRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async findUserById(id: string): Promise<AdminUserView | undefined> {
    const [row] = await this.db
      .select(ADMIN_USER_COLUMNS)
      .from(users)
      .where(and(eq(users.id, id), sql`${users.deletedAt} IS NULL`))
      .limit(1);
    return row;
  }

  public async lookupUsers(
    query: string,
    limit = 20,
  ): Promise<AdminUserView[]> {
    const like = `%${query.toLowerCase()}%`;
    return this.db
      .select(ADMIN_USER_COLUMNS)
      .from(users)
      .where(
        and(
          sql`${users.deletedAt} IS NULL`,
          or(
            sql`lower(${users.email}) LIKE ${like}`,
            sql`lower(${users.displayName}) LIKE ${like}`,
          ),
        ),
      )
      .limit(limit);
  }

  public async findWorkspaceById(
    id: string,
  ): Promise<WorkspaceRow | undefined> {
    const [row] = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);
    return row;
  }

  public async lookupWorkspaces(
    query: string,
    limit = 20,
  ): Promise<WorkspaceRow[]> {
    const like = `%${query.toLowerCase()}%`;
    return this.db
      .select()
      .from(workspaces)
      .where(
        or(
          sql`lower(${workspaces.name}) LIKE ${like}`,
          sql`lower(${workspaces.slug}) LIKE ${like}`,
        ),
      )
      .limit(limit);
  }
}
