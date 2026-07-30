import { Injectable } from '@nestjs/common';
import type { AiProvider } from '../interfaces/ai-provider.interface';

@Injectable()
export class MockAiProvider implements AiProvider {
  async summarizeBoard(
    boardTitle: string,
    tasks: Array<{
      title: string;
      column: string;
      description?: string | null;
    }>,
  ): Promise<string> {
    await Promise.resolve();
    const taskCount = tasks.length;
    const columns = Array.from(new Set(tasks.map((t) => t.column)));
    const summary = [
      `### Board Summary: ${boardTitle}`,
      `Total Tasks: **${taskCount}** across **${columns.length}** columns (${columns.join(', ')}).`,
      `Key Highlights:`,
      ...tasks.slice(0, 5).map((t) => `- **[${t.column}]** ${t.title}`),
    ].join('\n');
    return summary;
  }

  async generateIdeas(
    topic: string,
    count = 4,
  ): Promise<Array<{ title: string; text: string; color: string }>> {
    await Promise.resolve();
    const colors = ['#FEF08A', '#BAE6FD', '#BBF7D0', '#FBCFE8'];
    const ideas = [
      {
        title: `Brainstorm: ${topic}`,
        text: `Analyze key user requirements and define scope boundaries for ${topic}.`,
        color: colors[0],
      },
      {
        title: `Architecture Plan`,
        text: `Design decoupled modular architecture with clear service contracts for ${topic}.`,
        color: colors[1],
      },
      {
        title: `Implementation Step`,
        text: `Build backend services, DTO validation, and automated unit tests for ${topic}.`,
        color: colors[2],
      },
      {
        title: `UI & UX Design`,
        text: `Implement responsive interface with micro-interactions for ${topic}.`,
        color: colors[3],
      },
    ];
    return ideas.slice(0, count);
  }
}
