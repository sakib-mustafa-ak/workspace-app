import { api } from './api';

function buildQuery(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&');
}

export type Notification = {
  id: string;
  userId: string;
  type: string;
  channel: string;
  status: string;
  title: string;
  body: string | null;
  resourceType: string | null;
  resourceId: string | null;
  readAt: string | null;
  deliveredAt: string | null;
  archivedAt: string | null;
  createdAt: string;
};

export type NotificationsListResponse = {
  data: Notification[];
  total: number;
};

export type NotificationCreatedSocketPayload = {
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
};

export const notificationsApi = {
  list: (params?: { limit?: number; offset?: number; filter?: string }) =>
    api.get<NotificationsListResponse>(`/notifications${buildQuery(params as Record<string, string | number | undefined>)}`),
  getById: (id: string) =>
    api.get<Notification>(`/notifications/${id}`),
  countUnread: () =>
    api.get<{ count: number }>('/notifications/unread/count'),
  markAsRead: (id: string) =>
    api.patch<Notification>(`/notifications/${id}/read`),
  markAllAsRead: () =>
    api.post<void>('/notifications/read-all'),
  archive: (id: string) =>
    api.delete<void>(`/notifications/${id}`),
};
