import { api } from './api';

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  isAdmin: boolean;
  createdAt?: string;
};

export type AdminWorkspace = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type AdminAuditEntry = {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AdminAuditFilters = {
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
};

export const adminApi = {
  searchUsers: (query: string) =>
    api.get<AdminUser[]>(`/admin/users?query=${encodeURIComponent(query)}`),
  searchWorkspaces: (query: string) =>
    api.get<AdminWorkspace[]>(
      `/admin/workspaces?query=${encodeURIComponent(query)}`,
    ),
  getSubscription: (userId: string) =>
    api.get<{ plan: string; status: string }>(
      `/admin/users/${userId}/subscription`,
    ),
  impersonate: (userId: string) =>
    api.post<{ token: string; expiresInSeconds: number; user: AdminUser }>(
      `/admin/users/${userId}/impersonate`,
    ),
  getAudit: (filters: AdminAuditFilters) => {
    const params = new URLSearchParams();
    if (filters.actorId) params.set('actorId', filters.actorId);
    if (filters.action) params.set('action', filters.action);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    const qs = params.toString();
    return api.get<AdminAuditEntry[]>(`/admin/audit${qs ? `?${qs}` : ''}`);
  },
};
