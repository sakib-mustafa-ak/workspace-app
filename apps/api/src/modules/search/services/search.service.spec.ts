import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { BoardsRepository } from '../../boards/repositories/boards.repository';
import { TasksRepository } from '../../tasks/repositories/tasks.repository';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';

describe('SearchService', () => {
  let service: SearchService;
  let boardsRepo: jest.Mocked<BoardsRepository>;
  let tasksRepo: jest.Mocked<TasksRepository>;
  let membersRepo: jest.Mocked<WorkspaceMembersRepository>;

  beforeEach(async () => {
    boardsRepo = {
      searchByQuery: jest.fn(),
    } as unknown as jest.Mocked<BoardsRepository>;
    tasksRepo = {
      searchByQuery: jest.fn(),
    } as unknown as jest.Mocked<TasksRepository>;
    membersRepo = {
      listByUser: jest.fn(),
    } as unknown as jest.Mocked<WorkspaceMembersRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: BoardsRepository, useValue: boardsRepo },
        { provide: TasksRepository, useValue: tasksRepo },
        { provide: WorkspaceMembersRepository, useValue: membersRepo },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('returns empty results for an empty query', async () => {
    const res = await service.searchGlobal('user-1', '');
    expect(res.boards).toHaveLength(0);
    expect(res.tasks).toHaveLength(0);
  });

  it('returns mapped boards and tasks scoped to the user workspaces', async () => {
    membersRepo.listByUser.mockResolvedValue([
      { id: 'm-1', workspaceId: 'ws-1', userId: 'user-1' } as any,
    ]);
    boardsRepo.searchByQuery.mockResolvedValue([
      { id: 'b-1', name: 'Frontend Architecture', workspaceId: 'ws-1' } as any,
    ]);
    tasksRepo.searchByQuery.mockResolvedValue([
      {
        id: 't-1',
        boardId: 'b-1',
        workspaceId: 'ws-1',
        title: 'Fix login redirect',
      } as any,
    ]);

    const res = await service.searchGlobal('user-1', 'login');
    expect(res.query).toBe('login');
    expect(res.boards).toEqual([
      {
        id: 'b-1',
        title: 'Frontend Architecture',
        workspaceId: 'ws-1',
        type: 'board',
      },
    ]);
    expect(res.tasks).toEqual([
      {
        id: 't-1',
        title: 'Fix login redirect',
        boardId: 'b-1',
        workspaceId: 'ws-1',
        type: 'task',
      },
    ]);
    expect(boardsRepo.searchByQuery).toHaveBeenCalledWith(
      ['ws-1'],
      'login',
      20,
    );
    expect(tasksRepo.searchByQuery).toHaveBeenCalledWith(['ws-1'], 'login', 20);
  });

  it('returns empty results when the user has no workspaces', async () => {
    membersRepo.listByUser.mockResolvedValue([]);
    const res = await service.searchGlobal('user-1', 'anything');
    expect(res.boards).toHaveLength(0);
    expect(res.tasks).toHaveLength(0);
    expect(boardsRepo.searchByQuery).not.toHaveBeenCalled();
  });
});
