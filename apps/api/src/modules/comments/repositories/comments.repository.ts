import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  desc,
  eq,
  sql,
  type BoardCommentRow,
  type BoardRow,
  type Db,
  type NewBoardCommentRow,
  boardComments,
  boards,
  users,
} from '@repo/database';

@Injectable()
export class CommentsRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async create(row: NewBoardCommentRow): Promise<BoardCommentRow> {
    const [created] = await this.db
      .insert(boardComments)
      .values(row)
      .returning();
    if (!created) throw new Error('Failed to insert comment.');
    return created;
  }

  public async findById(id: string): Promise<BoardCommentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(boardComments)
      .where(
        sql`${boardComments.id} = ${id} AND ${boardComments.deletedAt} IS NULL`,
      )
      .limit(1);
    return row;
  }

  public async findByBoard(boardId: string): Promise<BoardCommentRow[]> {
    return this.db
      .select()
      .from(boardComments)
      .where(
        and(
          eq(boardComments.boardId, boardId),
          sql`${boardComments.deletedAt} IS NULL`,
        ),
      )
      .orderBy(desc(boardComments.createdAt));
  }

  /** Comments with the author's display name + avatar joined in, so the UI
   *  can render messaging-app-style avatars without a second query. */
  public async findByBoardWithAuthor(boardId: string): Promise<
    Array<
      BoardCommentRow & {
        author: { displayName: string; avatarUrl: string | null } | null;
      }
    >
  > {
    const rows = await this.db
      .select({
        comment: boardComments,
        user: { displayName: users.displayName, avatarUrl: users.avatarUrl },
      })
      .from(boardComments)
      .innerJoin(users, eq(boardComments.userId, users.id))
      .where(
        and(
          eq(boardComments.boardId, boardId),
          sql`${boardComments.deletedAt} IS NULL`,
        ),
      )
      .orderBy(desc(boardComments.createdAt));
    return rows.map((r) => ({ ...r.comment, author: r.user }));
  }

  public async findReplies(parentId: string): Promise<BoardCommentRow[]> {
    return this.db
      .select()
      .from(boardComments)
      .where(
        and(
          eq(boardComments.parentId, parentId),
          sql`${boardComments.deletedAt} IS NULL`,
        ),
      )
      .orderBy(boardComments.createdAt);
  }

  public async update(
    id: string,
    data: { content: string },
  ): Promise<BoardCommentRow> {
    const [updated] = await this.db
      .update(boardComments)
      .set({
        content: data.content,
        editedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(boardComments.id, id), sql`${boardComments.deletedAt} IS NULL`),
      )
      .returning();
    if (!updated) throw new Error('Failed to update comment.');
    return updated;
  }

  public async softDelete(id: string): Promise<void> {
    await this.db
      .update(boardComments)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(boardComments.id, id));
  }

  public async findBoardById(id: string): Promise<BoardRow | undefined> {
    const [row] = await this.db
      .select()
      .from(boards)
      .where(sql`${boards.id} = ${id} AND ${boards.deletedAt} IS NULL`)
      .limit(1);
    return row;
  }
}
