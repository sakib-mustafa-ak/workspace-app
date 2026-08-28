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
};
