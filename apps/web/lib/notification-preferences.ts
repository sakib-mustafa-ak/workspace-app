import { api } from './api';

export type NotificationPreference = {
  type: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
};

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  COMMENT_ADDED: 'Someone comments on a board you are in',
  BOARD_SHARED: 'A board is shared with you',
  WORKSPACE_UPDATED: 'Your workspace is updated',
  MENTION_CREATED: 'You are mentioned',
  MEMBER_ADDED: 'You are added to a workspace',
  INVITATION_ACCEPTED: 'Someone accepts your invitation',
  TASK_ASSIGNED: 'You are assigned a task',
  TASK_UNASSIGNED: 'You are unassigned from a task',
  TASK_DELETED: 'A task you were assigned is deleted',
  FILE_UPLOADED: 'A file is uploaded to your board',
};

export const notificationPreferencesApi = {
  get: () =>
    api.get<{ preferences: NotificationPreference[] }>(
      '/users/me/notification-preferences',
    ),
  update: (preferences: NotificationPreference[]) =>
    api.put<{ preferences: NotificationPreference[] }>(
      '/users/me/notification-preferences',
      { preferences },
    ),
};
