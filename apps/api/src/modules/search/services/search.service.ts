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
    if (!query || query.trim().length === 0) {
      return { boards: [], tasks: [] };
    }

    const cleanQuery = query.toLowerCase().trim();

    // Fetch user memberships to restrict search results to accessible workspaces
    const userMemberships = await this.membersRepo.listByUser(userId);
    const workspaceIds = userMemberships.map((m) => m.workspaceId);

    const matchingBoards: Array<{
      id: string;
      title: string;
      workspaceId: string;
      type: string;
    }> = [];
    const matchingTasks: Array<{
      id: string;
      title: string;
      boardId: string;
      workspaceId: string;
      type: string;
    }> = [];

    for (const wsId of workspaceIds) {
      const boards = await this.boardsRepo.listByWorkspace(wsId);
      for (const b of boards) {
        if (
          b.name.toLowerCase().includes(cleanQuery) ||
          b.description?.toLowerCase().includes(cleanQuery)
        ) {
          matchingBoards.push({
            id: b.id,
            title: b.name,
            workspaceId: b.workspaceId,
            type: 'board',
          });
        }
        // Task titles inside each accessible board
        const boardTasks = await this.tasksRepo.listByBoard(b.id);
        for (const t of boardTasks) {
          if (t.title.toLowerCase().includes(cleanQuery)) {
            matchingTasks.push({
              id: t.id,
              title: t.title,
              boardId: t.boardId,
              workspaceId: b.workspaceId,
              type: 'task',
            });
          }
        }
      }
    }

    return {
      query: cleanQuery,
      boards: matchingBoards,
      tasks: matchingTasks,
    };
  }
}
