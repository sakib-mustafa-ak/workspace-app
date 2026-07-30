import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { BoardsRepository } from '../../boards/repositories/boards.repository';
import { GeminiAiProvider } from '../providers/gemini-ai.provider';
import { MockAiProvider } from '../providers/mock-ai.provider';

describe('AiService', () => {
  let service: AiService;
  let boardsRepo: jest.Mocked<BoardsRepository>;

  beforeEach(async () => {
    boardsRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<BoardsRepository>;

    const mockAiProvider = new MockAiProvider();
    const geminiAiProvider = new GeminiAiProvider(mockAiProvider);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: BoardsRepository, useValue: boardsRepo },
        { provide: GeminiAiProvider, useValue: geminiAiProvider },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should generate summary for board', async () => {
    boardsRepo.findById.mockResolvedValue({
      id: 'b-1',
      name: 'Sprint 1',
    } as any);

    const res = await service.summarizeBoard('b-1');
    expect(res.title).toBe('Sprint 1');
    expect(res.summary).toContain('Sprint 1');
  });

  it('should generate ideas for topic', async () => {
    const res = await service.generateIdeas('Architecture', 2);
    expect(res.ideas).toHaveLength(2);
    expect(res.ideas[0].title).toBeDefined();
  });
});
