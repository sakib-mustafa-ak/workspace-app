export interface AiProvider {
  summarizeBoard(
    boardTitle: string,
    tasks: Array<{
      title: string;
      column: string;
      description?: string | null;
    }>,
  ): Promise<string>;
  generateIdeas(
    topic: string,
    count?: number,
  ): Promise<Array<{ title: string; text: string; color: string }>>;
}
