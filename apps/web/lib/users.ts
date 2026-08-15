import { api } from './api';

function buildQuery(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&');
}

export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  timezone: string | null;
  locale: string | null;
  status: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpdateProfileData = {
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  timezone?: string | null;
  locale?: string | null;
};

export type UserListParams = {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type UserListResponse = {
  users: UserProfile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type UserMembership = {
  workspaceId: string;
  workspaceName: string;
  role: string;
  joinedAt: string;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export const usersApi = {
  getMe: () => api.get<UserProfile>('/users/me'),
  updateMe: (data: UpdateProfileData) =>
    api.patch<UserProfile>('/users/me', data),
  getById: (id: string) =>
    api.get<UserProfile>(`/users/${id}`),
  list: (params?: UserListParams) =>
    api.get<UserListResponse>(`/users${buildQuery(params as Record<string, string | number | undefined>)}`),
  getMemberships: (id: string) =>
    api.get<UserMembership[]>(`/users/${id}/memberships`),
  getActivity: (id: string) =>
    api.get<AuditLogEntry[]>(`/users/${id}/activity`),
};
