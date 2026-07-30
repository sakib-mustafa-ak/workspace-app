import { api } from './api';

export type ChecklistItem = {
  id: string;
  taskId: string;
  text: string;
  completed: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export const checklistApi = {
  list: (workspaceId: string, boardId: string, taskId: string) =>
    api.get<ChecklistItem[]>(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/checklist`),
  create: (workspaceId: string, boardId: string, taskId: string, data: { text: string; position?: number }) =>
    api.post<ChecklistItem>(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/checklist`, data),
  update: (workspaceId: string, boardId: string, taskId: string, itemId: string, data: { text?: string; completed?: boolean; position?: number }) =>
    api.patch<ChecklistItem>(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/checklist/${itemId}`, data),
  delete: (workspaceId: string, boardId: string, taskId: string, itemId: string) =>
    api.delete<void>(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/checklist/${itemId}`),
};
