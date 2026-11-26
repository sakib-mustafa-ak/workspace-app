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
  list: () => api.get<PluginCatalog>("/plugins"),
  set: (key: string, enabled: boolean) =>
    api.put("/plugins" + `/${key}`, { enabled }),
  connect: (key: string) =>
    api.post<{ url: string; state: string }>("/plugins" + `/${key}/connect`),
  complete: (key: string, state: string, code: string) =>
    api.post("/plugins" + `/${key}/complete`, { state, code }),
  data: (key: string, repository?: string) =>
    api.get<PluginItem[]>(
      "/plugins" +
        `/${key}/data` +
        (repository ? `?repository=${encodeURIComponent(repository)}` : ""),
    ),
  send: (channel: string, text: string) =>
    api.post("/plugins/slack/messages", { channel, text }),
  task: (id: string, taskId: string) =>
    api.get<TaskPluginStatus>(base(id) + `/tasks/${taskId}`),
  vote: (id: string, taskId: string, voted: boolean) =>
    api.put(base(id) + `/tasks/${taskId}/vote`, { voted }),
  start: (id: string, taskId: string) =>
    api.post(base(id) + `/tasks/${taskId}/timer`),
  stop: (workspaceId?: string) =>
    api.post(
      workspaceId ? base(workspaceId) + "/timers/stop" : "/plugins/timers/stop",
    ),
  time: () => api.get<TimeEntry[]>("/plugins/timers/mine"),
};
