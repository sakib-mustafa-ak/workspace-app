import { api } from "./api";
import type { Board } from "./boards";
import type { Task } from "./tasks";

export type HomeBoard = Board & {
  accessUserIds: string[] | null;
  topTasks: Task[];
  activeUsers: { userId: string; displayName: string }[];
};
export type WorkspaceHomeData = {
  role: string;
  todayTasks: Task[];
  todayLimit: number;
  upcomingTasks: Task[];
  upcomingLimit: number;
  boards: HomeBoard[];
};
export type BoardAccess = {
  mode: "workspace" | "restricted";
  userIds: string[] | null;
};
export const workspaceHomeApi = {
  get: (id: string) =>
    api.get<WorkspaceHomeData>(
      `/workspaces/${id}/home?offset=${new Date().getTimezoneOffset()}`,
    ),
  getAccess: (workspaceId: string, boardId: string) =>
    api.get<BoardAccess>(`/workspaces/${workspaceId}/boards/${boardId}/access`),
  setAccess: (
    workspaceId: string,
    boardId: string,
    mode: BoardAccess["mode"],
    userIds: string[],
  ) =>
    api.put<BoardAccess>(
      `/workspaces/${workspaceId}/boards/${boardId}/access`,
      { mode, userIds },
    ),
};
