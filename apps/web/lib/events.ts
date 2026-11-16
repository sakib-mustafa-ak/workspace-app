import { api } from './api';

export type PersonalEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  notes: string | null;
};
export type EventInput = Omit<PersonalEvent, 'id'>;
export const eventsApi = {
  list: () => api.get<PersonalEvent[]>('/events'),
  create: (input: EventInput) => api.post<PersonalEvent>('/events', input),
  update: (id: string, input: EventInput) => api.put<PersonalEvent>(`/events/${id}`, input),
  remove: (id: string) => api.delete<void>(`/events/${id}`),
};
