import { api } from './api';

export type Task = {
  id: string;
  workspaceId: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  status: string;
  priority: string;
  assigneeId: string | null;
  createdById: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  boardName?: string;
  workspaceName?: string;
};

export type CreateTaskData = {
  title: string;
  description?: string;
  priority?: string;
  assigneeId?: string;
  dueDate?: string;
  position?: number;
};

export type UpdateTaskData = {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  position?: number;
};

export const tasksApi = {
  listByBoard: (workspaceId: string, boardId: string) =>
    api.get<Task[]>(`/workspaces/${workspaceId}/boards/${boardId}/tasks`),
  listByUser: (limit?: number) =>
    api.get<Task[]>(`/tasks${limit ? `?limit=${limit}` : ''}`),
  create: (workspaceId: string, boardId: string, columnId: string, data: CreateTaskData) =>
    api.post<Task>(`/workspaces/${workspaceId}/boards/${boardId}/tasks/columns/${columnId}`, data),
  update: (workspaceId: string, boardId: string, taskId: string, data: UpdateTaskData) =>
    api.patch<Task>(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}`, data),
  move: (workspaceId: string, boardId: string, taskId: string, data: { columnId: string; position?: number }) =>
    api.patch<Task>(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/move`, data),
  delete: (workspaceId: string, boardId: string, taskId: string) =>
    api.delete<void>(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}`),
};
