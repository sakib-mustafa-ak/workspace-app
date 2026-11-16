import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  boardColumns,
  checklistItems,
  boardComments as comments,
  DATABASE,
  eq,
  tasks,
  uploadedFiles,
  type Db,
} from '@repo/database';
import { BoardAccessService } from './board-access.service';
import { isUuid } from '../utils/is-uuid';

@Injectable()
export class BoardAccessGuard implements CanActivate {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    private readonly access: BoardAccessService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: { id: string };
      params: Record<string, string>;
      body?: { assigneeId?: string; columnId?: string };
    }>();
    const params = request.params ?? {};
    const ids = new Set<string>();
    if (params.boardId) ids.add(params.boardId);
    const denied = () => {
      throw new ForbiddenException('Board access denied.');
    };
    // Resolve the actual child, not merely a user-controlled parent in the URL.
    if (params.taskId) {
      if (!isUuid(params.taskId)) denied();
      const [task] = await this.db
        .select({ boardId: tasks.boardId })
        .from(tasks)
        .where(eq(tasks.id, params.taskId))
        .limit(1);
      if (!task) denied();
      ids.add(task.boardId);
    }
    if (params.columnId || request.body?.columnId) {
      const columnId = params.columnId ?? request.body!.columnId!;
      if (!isUuid(columnId)) denied();
      const [column] = await this.db
        .select({ boardId: boardColumns.boardId })
        .from(boardColumns)
        .where(eq(boardColumns.id, columnId))
        .limit(1);
      if (!column) denied();
      ids.add(column.boardId);
    }
    if (params.commentId) {
      if (!isUuid(params.commentId)) denied();
      const [comment] = await this.db
        .select({ boardId: comments.boardId })
        .from(comments)
        .where(eq(comments.id, params.commentId))
        .limit(1);
      if (!comment) denied();
      ids.add(comment.boardId);
    }
    if (params.itemId) {
      if (!isUuid(params.itemId)) denied();
      const [item] = await this.db
        .select({ boardId: tasks.boardId })
        .from(checklistItems)
        .innerJoin(tasks, eq(tasks.id, checklistItems.taskId))
        .where(eq(checklistItems.id, params.itemId))
        .limit(1);
      if (!item) denied();
      ids.add(item.boardId);
    }
    if (params.uploadId) {
      if (!isUuid(params.uploadId)) denied();
      const [upload] = await this.db
        .select({ boardId: uploadedFiles.boardId })
        .from(uploadedFiles)
        .where(eq(uploadedFiles.id, params.uploadId))
        .limit(1);
      if (!upload) denied();
      if (upload.boardId) ids.add(upload.boardId);
    }
    if (ids.size > 1) denied();
    for (const id of ids) {
      if (!request.user?.id || !isUuid(id)) denied();
      await this.access.require(id, request.user!.id, params.workspaceId);
      if (request.body?.assigneeId)
        await this.access.require(
          id,
          request.body.assigneeId,
          params.workspaceId,
        );
    }
    return true;
  }
}
