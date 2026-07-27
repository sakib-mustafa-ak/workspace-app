import { api } from './api';

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  status: string;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  status: string;
  joinedAt: string | null;
};

export type Invitation = {
  id: string;
  workspaceId: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
};

export const workspacesApi = {
  list: () => api.get<Workspace[]>('/workspaces'),
  getById: (id: string) => api.get<Workspace>(`/workspaces/${id}`),
  create: (data: { name: string; slug: string; description?: string }) =>
    api.post<Workspace>('/workspaces', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<Workspace>(`/workspaces/${id}`, data),
  archive: (id: string) => api.post<void>(`/workspaces/${id}/archive`),
  unarchive: (id: string) => api.post<void>(`/workspaces/${id}/unarchive`),
  delete: (id: string) => api.delete<void>(`/workspaces/${id}`),
  getMembers: (id: string) =>
    api.get<WorkspaceMember[]>(`/workspaces/${id}/members`),
};
