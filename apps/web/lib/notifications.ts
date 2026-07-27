import { api } from './api';

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

export const notificationsApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.offset) search.set('offset', String(params.offset));
    const qs = search.toString();
    return api.get<Notification[]>(`/notifications${qs ? `?${qs}` : ''}`);
  },
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
