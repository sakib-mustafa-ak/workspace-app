import { Inject, Injectable } from '@nestjs/common';
import { BoardsRepository } from '../../boards/repositories/boards.repository';
import { TasksRepository } from '../../tasks/repositories/tasks.repository';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';

@Injectable()
export class SearchService {
  constructor(
    @Inject(BoardsRepository) private readonly boardsRepo: BoardsRepository,
    @Inject(TasksRepository) private readonly tasksRepo: TasksRepository,
    @Inject(WorkspaceMembersRepository)
    private readonly membersRepo: WorkspaceMembersRepository,
  ) {}

  async searchGlobal(userId: string, query: string) {
    const cleanQuery = query?.trim() ?? '';
    if (!cleanQuery) {
      return { boards: [], tasks: [] };
    }

    const memberships = await this.membersRepo.listByUser(userId);
    const workspaceIds = memberships.map((m) => m.workspaceId);
    if (workspaceIds.length === 0) {
      return { query: cleanQuery, boards: [], tasks: [] };
    }

    const [boards, tasks] = await Promise.all([
      this.boardsRepo.searchByQuery(workspaceIds, cleanQuery, 20),
      this.tasksRepo.searchByQuery(workspaceIds, cleanQuery, 20),
    ]);

    return {
      query: cleanQuery,
      boards: boards.map((b) => ({
        id: b.id,
        title: b.name,
        workspaceId: b.workspaceId,
        type: 'board',
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        boardId: t.boardId,
        workspaceId: t.workspaceId,
        type: 'task',
      })),
    };
  }
}
