import { api } from './api';

export type Board = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  position: number;
  status: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BoardColumn = {
  id: string;
  boardId: string;
  name: string;
  position: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export const boardsApi = {
  list: (workspaceId: string) =>
    api.get<Board[]>(`/workspaces/${workspaceId}/boards`),
  getById: (workspaceId: string, boardId: string) =>
    api.get<Board>(`/workspaces/${workspaceId}/boards/${boardId}`),
  create: (workspaceId: string, data: { name: string; description?: string }) =>
    api.post<Board>(`/workspaces/${workspaceId}/boards`, data),
  archive: (workspaceId: string, boardId: string) =>
    api.post<void>(`/workspaces/${workspaceId}/boards/${boardId}/archive`),
  delete: (workspaceId: string, boardId: string) =>
    api.delete<void>(`/workspaces/${workspaceId}/boards/${boardId}`),
  getColumns: (workspaceId: string, boardId: string) =>
    api.get<BoardColumn[]>(
      `/workspaces/${workspaceId}/boards/${boardId}/columns`,
    ),
};
