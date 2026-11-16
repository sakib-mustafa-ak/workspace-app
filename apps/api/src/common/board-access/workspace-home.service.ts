import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  boards,
  DATABASE,
  eq,
  getTableColumns,
  gte,
  isNull,
  lt,
  lte,
  notInArray,
  sql,
  tasks,
  workspaceMembers,
  type Db,
} from '@repo/database';
import { boardVisibleTo } from './board-visibility';
import { BoardPresenceService } from './board-presence.service';

@Injectable()
export class WorkspaceHomeService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    private readonly presence: BoardPresenceService,
  ) {}
  async get(workspaceId: string, userId: string, offset: number) {
    const [member] = await this.db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    const visible = and(
      eq(boards.workspaceId, workspaceId),
      eq(boards.status, 'ACTIVE'),
      boardVisibleTo(userId, boards.id),
    );
    const boardList = await this.db
      .select()
      .from(boards)
      .where(visible)
      .orderBy(asc(boards.position), asc(boards.createdAt));
    const endOfToday = new Date(Date.now() - offset * 60_000);
    endOfToday.setUTCHours(24, 0, 0, 0);
    const dueBefore = new Date(endOfToday.getTime() + offset * 60_000);
    const priority = sql`CASE ${tasks.priority} WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END`;
    const open = and(
      eq(tasks.workspaceId, workspaceId),
      isNull(tasks.deletedAt),
      notInArray(tasks.status, ['DONE', 'CANCELLED']),
      boardVisibleTo(userId, tasks.boardId),
      sql`EXISTS (SELECT 1 FROM boards b WHERE b.id = ${tasks.boardId} AND b.status = 'ACTIVE')`,
    );
    const ranked = this.db
      .select({
        ...getTableColumns(tasks),
        rank: sql<number>`row_number() OVER (PARTITION BY ${tasks.boardId} ORDER BY ${priority}, ${tasks.dueDate} ASC NULLS LAST, ${tasks.id})`.as(
          'rank',
        ),
      })
      .from(tasks)
      .where(open)
      .as('ranked');
    const [previews, todayTasks, upcomingTasks] = await Promise.all([
      this.db.select().from(ranked).where(lte(ranked.rank, 3)),
      this.db
        .select()
        .from(tasks)
        .where(
          and(open, eq(tasks.assigneeId, userId), lt(tasks.dueDate, dueBefore)),
        )
        .orderBy(priority, asc(tasks.dueDate), asc(tasks.id))
        .limit(200),
      this.db
        .select()
        .from(tasks)
        .where(
          and(
            open,
            eq(tasks.assigneeId, userId),
            gte(tasks.dueDate, dueBefore),
          ),
        )
        .orderBy(asc(tasks.dueDate), priority, asc(tasks.id))
        .limit(10),
    ]);
    return {
      role: member?.role,
      todayTasks,
      todayLimit: 200,
      upcomingTasks,
      upcomingLimit: 10,
      boards: boardList.map((board) => ({
        ...board,
        topTasks: previews.filter((task) => task.boardId === board.id),
        activeUsers: this.presence.list(board.id),
      })),
    };
  }
}
