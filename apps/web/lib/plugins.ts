import { api } from "./api";

export type Plugin = {
  key: string;
  name: string;
  description: string;
  category: "addon" | "integration" | "custom";
  permissions: string[];
  setupKeys?: string[];
  comingSoon?: boolean;
  available: boolean;
  enabled: boolean;
  connected: boolean;
  ownedConnection: boolean;
};
export type PluginCatalog = { canManage: boolean; plugins: Plugin[] };
export type PluginItem = {
  id: string;
  title: string;
  url?: string;
  startsAt?: string;
  canSend?: boolean;
};
export type TaskPluginStatus = {
  voting: boolean;
  tracking: boolean;
  canTrack: boolean;
  votes: number;
  voted: boolean;
  seconds: number;
  runningTaskId: string | null;
};
export type TimeEntry = {
  id: string;
  startedAt: string;
  endedAt: string | null;
};
const base = (workspaceId: string) => `/workspaces/${workspaceId}/plugins`;
export const pluginsApi = {
  list: (id: string) => api.get<PluginCatalog>(base(id)),
  set: (id: string, key: string, enabled: boolean) =>
    api.put(base(id) + `/${key}`, { enabled }),
  connect: (id: string, key: string) =>
    api.post<{ url: string; state: string }>(base(id) + `/${key}/connect`),
  complete: (id: string, key: string, state: string, code: string) =>
    api.post(base(id) + `/${key}/complete`, { state, code }),
  data: (id: string, key: string, repository?: string) =>
    api.get<PluginItem[]>(
      base(id) +
        `/${key}/data` +
        (repository ? `?repository=${encodeURIComponent(repository)}` : ""),
    ),
  send: (id: string, channel: string, text: string) =>
    api.post(base(id) + "/slack/messages", { channel, text }),
  task: (id: string, taskId: string) =>
    api.get<TaskPluginStatus>(base(id) + `/tasks/${taskId}`),
  vote: (id: string, taskId: string, voted: boolean) =>
    api.put(base(id) + `/tasks/${taskId}/vote`, { voted }),
  start: (id: string, taskId: string) =>
    api.post(base(id) + `/tasks/${taskId}/timer`),
  stop: (id: string) => api.post(base(id) + "/timers/stop"),
  time: (id: string) => api.get<TimeEntry[]>(base(id) + "/timers/mine"),
};
