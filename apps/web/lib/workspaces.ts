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
  createdAt: string;
  updatedAt: string;
};

export type Invitation = {
  id: string;
  workspaceId: string;
  email: string;
  role: string;
  status: string;
  invitedById: string;
  acceptedById: string | null;
  acceptedAt: string | null;
  expiresAt: string;
  createdAt: string;
};

export const workspacesApi = {
  list: () => api.get<Workspace[]>('/workspaces'),
  getById: (id: string) => api.get<Workspace>(`/workspaces/${id}`),
  create: (data: { name: string; slug: string; description?: string }) =>
    api.post<Workspace>('/workspaces', data),
  update: (id: string, data: { name?: string; description?: string | null }) =>
    api.patch<Workspace>(`/workspaces/${id}`, data),
  archive: (id: string) => api.post<void>(`/workspaces/${id}/archive`),
  unarchive: (id: string) => api.post<void>(`/workspaces/${id}/unarchive`),
  delete: (id: string) => api.delete<void>(`/workspaces/${id}`),
  getMembers: (id: string) =>
    api.get<WorkspaceMember[]>(`/workspaces/${id}/members`),
  changeMemberRole: (id: string, userId: string, role: string) =>
    api.patch<WorkspaceMember>(`/workspaces/${id}/members/${userId}/role`, { role }),
  removeMember: (id: string, userId: string) =>
    api.delete<void>(`/workspaces/${id}/members/${userId}`),
  createInvitation: (id: string, data: { email: string; role: string }) =>
    api.post<{ token: string; selector: string }>(`/workspaces/${id}/invitations`, data),
  listInvitations: (id: string) =>
    api.get<Invitation[]>(`/workspaces/${id}/invitations`),
  revokeInvitation: (id: string, invitationId: string) =>
    api.delete<void>(`/workspaces/${id}/invitations/${invitationId}`),
  acceptInvitation: (selector: string, verifier: string) =>
    api.post<{ workspaceId: string; message: string }>('/workspaces/invitations/accept', { selector, verifier }),
  getActivity: (id: string, params?: { cursor?: string; action?: string; resourceType?: string }) =>
    api.get<{ data: AuditEvent[]; nextCursor: string | null }>(`/workspaces/${id}/activity?${new URLSearchParams(params as Record<string, string>)}`),
};

export type AuditEvent = {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};
