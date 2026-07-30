import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BoardsRepository } from '../../boards/repositories/boards.repository';
import { GeminiAiProvider } from '../providers/gemini-ai.provider';

@Injectable()
export class AiService {
  constructor(
    @Inject(BoardsRepository) private readonly boardsRepo: BoardsRepository,
    @Inject(GeminiAiProvider) private readonly aiProvider: GeminiAiProvider,
  ) {}

  async summarizeBoard(boardId: string) {
    const board = await this.boardsRepo.findById(boardId);
    if (!board) {
      throw new NotFoundException('Board not found');
    }

    // Pass sample board details to AI provider
    const sampleTasks = [
      {
        title: 'Setup database schema',
        column: 'Done',
        description: 'PostgreSQL + Drizzle schema',
      },
      {
        title: 'Build auth module',
        column: 'Done',
        description: 'JWT & Session auth',
      },
      {
        title: 'Implement real-time canvas',
        column: 'In Progress',
        description: 'Socket.io WebSocket gateway',
      },
      {
        title: 'Integrate AI assistant',
        column: 'In Progress',
        description: 'Board summary and sticky note generation',
      },
    ];

    const summary = await this.aiProvider.summarizeBoard(
      board.name,
      sampleTasks,
    );
    return { boardId, title: board.name, summary };
  }

  async generateIdeas(topic: string, count = 4) {
    const ideas = await this.aiProvider.generateIdeas(topic, count);
    return { topic, ideas };
  }
}
