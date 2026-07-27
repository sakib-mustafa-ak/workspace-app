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
};

export const tasksApi = {
  listByBoard: (workspaceId: string, boardId: string) =>
    api.get<Task[]>(`/workspaces/${workspaceId}/boards/${boardId}/tasks`),
  listByColumn: (workspaceId: string, boardId: string, columnId: string) =>
    api.get<Task[]>(
      `/workspaces/${workspaceId}/boards/${boardId}/tasks/columns/${columnId}`,
    ),
  getById: (workspaceId: string, boardId: string, taskId: string) =>
    api.get<Task>(
      `/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}`,
    ),
};
