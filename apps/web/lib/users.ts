import { api } from './api';
import type { User } from './auth';

export type UpdateProfileData = {
  displayName?: string;
};

export const usersApi = {
  getMe: () => api.get<User>('/users/me'),
  updateMe: (data: UpdateProfileData) =>
    api.patch<User>('/users/me', data),
  getById: (id: string) =>
    api.get<User>(`/users/${id}`),
  list: () =>
    api.get<User[]>('/users'),
  delete: (id: string) =>
    api.delete<void>(`/users/${id}`),
};
