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
      listByWorkspace: jest.fn(),
    } as unknown as jest.Mocked<BoardsRepository>;

    tasksRepo = {
      listByBoard: jest.fn(),
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

  it('should return empty results if search query is empty', async () => {
    const res = await service.searchGlobal('user-1', '');
    expect(res.boards).toHaveLength(0);
    expect(res.tasks).toHaveLength(0);
  });

  it('should return matching boards for user workspaces', async () => {
    membersRepo.listByUser.mockResolvedValue([
      { id: 'm-1', workspaceId: 'ws-1', userId: 'user-1' } as any,
    ]);

    boardsRepo.listByWorkspace.mockResolvedValue([
      {
        id: 'b-1',
        workspaceId: 'ws-1',
        name: 'Frontend Architecture',
        description: 'Next.js components',
      } as any,
      {
        id: 'b-2',
        workspaceId: 'ws-1',
        name: 'Backend API',
        description: 'NestJS controllers',
      } as any,
    ]);

    tasksRepo.listByBoard.mockResolvedValue([]);

    const res = await service.searchGlobal('user-1', 'Frontend');
    expect(res.boards).toHaveLength(1);
    expect(res.boards[0].title).toBe('Frontend Architecture');
  });

  it('should return matching task titles across accessible boards', async () => {
    membersRepo.listByUser.mockResolvedValue([
      { id: 'm-1', workspaceId: 'ws-1', userId: 'user-1' } as any,
    ]);

    boardsRepo.listByWorkspace.mockResolvedValue([
      { id: 'b-1', workspaceId: 'ws-1', name: 'Sprint Board' } as any,
    ]);

    tasksRepo.listByBoard.mockResolvedValue([
      {
        id: 't-1',
        boardId: 'b-1',
        title: 'Fix login redirect',
      } as any,
      {
        id: 't-2',
        boardId: 'b-1',
        title: 'Polish canvas toolbar',
      } as any,
    ]);

    const res = await service.searchGlobal('user-1', 'login');
    expect(res.tasks).toHaveLength(1);
    expect(res.tasks[0].title).toBe('Fix login redirect');
    expect(res.tasks[0].type).toBe('task');
  });
});
