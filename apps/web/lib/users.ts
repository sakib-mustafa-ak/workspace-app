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
};

export type UserListResponse = {
  users: UserProfile[];
  total: number;
};

export const usersApi = {
  getMe: () => api.get<UserProfile>('/users/me'),
  updateMe: (data: UpdateProfileData) =>
    api.patch<UserProfile>('/users/me', data),
  getById: (id: string) =>
    api.get<UserProfile>(`/users/${id}`),
  list: (params?: { limit?: number; offset?: number }) =>
    api.get<UserListResponse>(`/users${buildQuery(params)}`),
  delete: (id: string) =>
    api.delete<void>(`/users/${id}`),
};
