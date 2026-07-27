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
  archivedAt: string | null;
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
  update: (workspaceId: string, boardId: string, data: { name?: string; description?: string | null }) =>
    api.patch<Board>(`/workspaces/${workspaceId}/boards/${boardId}`, data),
  archive: (workspaceId: string, boardId: string) =>
    api.post<void>(`/workspaces/${workspaceId}/boards/${boardId}/archive`),
  unarchive: (workspaceId: string, boardId: string) =>
    api.post<void>(`/workspaces/${workspaceId}/boards/${boardId}/unarchive`),
  delete: (workspaceId: string, boardId: string) =>
    api.delete<void>(`/workspaces/${workspaceId}/boards/${boardId}`),
  getColumns: (workspaceId: string, boardId: string) =>
    api.get<BoardColumn[]>(`/workspaces/${workspaceId}/boards/${boardId}/columns`),
  createColumn: (workspaceId: string, boardId: string, data: { name: string }) =>
    api.post<BoardColumn>(`/workspaces/${workspaceId}/boards/${boardId}/columns`, data),
  updateColumn: (workspaceId: string, boardId: string, columnId: string, data: { name: string }) =>
    api.patch<BoardColumn>(`/workspaces/${workspaceId}/boards/${boardId}/columns/${columnId}`, data),
  archiveColumn: (workspaceId: string, boardId: string, columnId: string) =>
    api.post<void>(`/workspaces/${workspaceId}/boards/${boardId}/columns/${columnId}/archive`),
};
