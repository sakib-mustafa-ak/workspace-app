import { api } from './api';

export const aiApi = {
  summarizeBoard: (boardId: string) =>
    api.post<{ summary: string }>(`/ai/boards/${boardId}/summarize`),
  generateIdeas: (topic: string, count = 4) =>
    api.post<{ ideas: { text: string; priority?: string }[] }>('/ai/ideas', { topic, count }),
};
