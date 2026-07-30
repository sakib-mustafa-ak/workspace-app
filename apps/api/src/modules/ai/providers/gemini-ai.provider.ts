import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AiProvider } from '../interfaces/ai-provider.interface';
import { MockAiProvider } from './mock-ai.provider';

@Injectable()
export class GeminiAiProvider implements AiProvider {
  private readonly logger = new Logger(GeminiAiProvider.name);

  constructor(
    @Inject(MockAiProvider) private readonly mockFallback: MockAiProvider,
  ) {}

  async summarizeBoard(
    boardTitle: string,
    tasks: Array<{
      title: string;
      column: string;
      description?: string | null;
    }>,
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.log('GEMINI_API_KEY missing, using MockAiProvider fallback');
      return this.mockFallback.summarizeBoard(boardTitle, tasks);
    }

    try {
      const prompt = `Summarize this Kanban board concise for team lead review:
Board Title: ${boardTitle}
Tasks:
${tasks.map((t) => `- [${t.column}] ${t.title}: ${t.description || 'No description'}`).join('\n')}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        },
      );

      if (!res.ok) {
        throw new Error(`Gemini API returned status ${res.status}`);
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
      return this.mockFallback.summarizeBoard(boardTitle, tasks);
    } catch (err) {
      this.logger.error(
        'Gemini API call failed, falling back to mock provider',
        err,
      );
      return this.mockFallback.summarizeBoard(boardTitle, tasks);
    }
  }

  async generateIdeas(
    topic: string,
    count = 4,
  ): Promise<Array<{ title: string; text: string; color: string }>> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return this.mockFallback.generateIdeas(topic, count);
    }

    try {
      const prompt = `Generate ${count} creative sticky note ideas for topic "${topic}".
Return ONLY a valid JSON array of objects with keys: "title", "text", "color" (hex color code e.g. #FEF08A, #BAE6FD, #BBF7D0, #FBCFE8). No markdown backticks.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        },
      );

      if (!res.ok) {
        throw new Error(`Gemini API error ${res.status}`);
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const cleaned = text.replace(/```json/g, '');
        const parsed = JSON.parse(cleaned) as unknown;
        if (Array.isArray(parsed)) {
          return (
            parsed as Array<{ title: string; text: string; color: string }>
          ).slice(0, count);
        }
      }
      return this.mockFallback.generateIdeas(topic, count);
    } catch (err) {
      this.logger.error('Gemini generateIdeas failed, using fallback', err);
      return this.mockFallback.generateIdeas(topic, count);
    }
  }
}
