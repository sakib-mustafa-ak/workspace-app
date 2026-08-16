import { api } from './api';

export type Comment = {
  id: string;
  boardId: string;
  workspaceId: string;
  parentId: string | null;
  content: string;
  userId: string;
  author?: { displayName: string; avatarUrl: string | null } | null;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const commentsApi = {
  list: (boardId: string) =>
    api.get<Comment[]>(`/boards/${boardId}/comments`),
  getById: (boardId: string, commentId: string) =>
    api.get<Comment>(`/boards/${boardId}/comments/${commentId}`),
  create: (boardId: string, data: { content: string; parentId?: string }) =>
    api.post<Comment>(`/boards/${boardId}/comments`, data),
  update: (boardId: string, commentId: string, data: { content: string }) =>
    api.patch<Comment>(`/boards/${boardId}/comments/${commentId}`, data),
  delete: (boardId: string, commentId: string) =>
    api.delete<void>(`/boards/${boardId}/comments/${commentId}`),
};
