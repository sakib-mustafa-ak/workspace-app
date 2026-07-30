import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { BoardsRepository } from '../../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';

describe('SearchService', () => {
  let service: SearchService;
  let boardsRepo: jest.Mocked<BoardsRepository>;
  let membersRepo: jest.Mocked<WorkspaceMembersRepository>;

  beforeEach(async () => {
    boardsRepo = {
      listByWorkspace: jest.fn(),
    } as unknown as jest.Mocked<BoardsRepository>;

    membersRepo = {
      listByUser: jest.fn(),
    } as unknown as jest.Mocked<WorkspaceMembersRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: BoardsRepository, useValue: boardsRepo },
        { provide: WorkspaceMembersRepository, useValue: membersRepo },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should return empty results if search query is empty', async () => {
    const res = await service.searchGlobal('user-1', '');
    expect(res.boards).toHaveLength(0);
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

    const res = await service.searchGlobal('user-1', 'Frontend');
    expect(res.boards).toHaveLength(1);
    expect(res.boards[0].title).toBe('Frontend Architecture');
  });
});
