import { api } from "./api";
import type { Board } from "./boards";

export type TrelloPreview = {
  name: string;
  lists: { name: string; cards: number }[];
  cardCount: number;
  checklistItemCount: number;
  skippedLists: number;
  skippedCards: number;
  warnings: string[];
};

export const trelloImportApi = {
  preview: (workspaceId: string, board: unknown) =>
    api.post<TrelloPreview>(
      `/workspaces/${workspaceId}/boards/trello/preview`,
      { board },
    ),
  importBoard: (workspaceId: string, board: unknown) =>
    api.post<{ board: Board; preview: TrelloPreview }>(
      `/workspaces/${workspaceId}/boards/trello/import`,
      { board },
    ),
};
