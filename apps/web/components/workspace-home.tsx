"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Circle,
  Columns3,
  LockKeyhole,
  Plus,
  RefreshCw,
  Settings2,
  SquarePen,
  Upload,
  X,
} from "lucide-react";
import { workspacesApi, type Workspace } from "@/lib/workspaces";
import { boardsApi } from "@/lib/boards";
import { tasksApi, type Task } from "@/lib/tasks";
import {
  workspaceHomeApi,
  type HomeBoard,
  type WorkspaceHomeData,
} from "@/lib/workspace-home";
import { ApiError } from "@/lib/api";
import { setLastActiveWorkspace } from "@/lib/active-workspace";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/contexts/toast-context";
import { TaskModal } from "./task-modal";
import { TrelloImportDialog } from "./trello-import-dialog";
import { BoardAccessDialog } from "./board-access-dialog";

const priorities: Record<string, string> = {
  CRITICAL: "text-red-400",
  HIGH: "text-orange-400",
  MEDIUM: "text-amber-400",
  LOW: "text-sky-400",
  NONE: "text-surface-500",
};
function Priority({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 text-[11px] ${priorities[value] ?? priorities.NONE}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current"
      />
      {value === "NONE"
        ? "No priority"
        : value.charAt(0) + value.slice(1).toLowerCase()}
    </span>
  );
}

function BoardRow({
  board,
  workspaceId,
  canManage,
  onAccess,
  onTask,
}: {
  board: HomeBoard;
  workspaceId: string;
  canManage: boolean;
  onAccess: () => void;
  onTask: (task: Task) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = expanded || hovered;
  const url = `/workspaces/${workspaceId}/boards/${board.id}`;
  return (
    <article
      className="rounded-xl border border-surface-800 bg-surface-900/40 transition-colors hover:border-surface-600"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-surface-700 bg-surface-800/60 text-surface-400">
          <Columns3 size={18} />
        </span>
        <Link href={url} className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-surface-200">
            {board.name}
          </h3>
          <p className="mt-1 truncate text-xs text-surface-500">
            {board.description || "Tasks, ideas, and a shared canvas"}
          </p>
        </Link>
        {canManage ? (
          <button
            onClick={onAccess}
            aria-label={`Manage access for ${board.name}`}
            title="Board access"
            className="rounded-lg p-2 text-surface-500 hover:bg-surface-800 hover:text-surface-200"
          >
            <LockKeyhole size={14} />
          </button>
        ) : (
          board.accessUserIds !== null && (
            <LockKeyhole
              size={13}
              aria-label="Restricted board"
              className="shrink-0 text-surface-500"
            />
          )
        )}
        <button
          aria-label={`${open ? "Hide" : "Show"} top tasks for ${board.name}`}
          aria-expanded={open}
          aria-controls={`preview-${board.id}`}
          onClick={() => {
            setHovered(false);
            setExpanded(!expanded);
          }}
          className="rounded-lg p-2 text-surface-400 hover:bg-surface-800 focus-visible:outline-primary-400"
        >
          <ChevronDown
            size={17}
            className={`transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {open && (
        <div
          id={`preview-${board.id}`}
          className="border-t border-surface-800 px-4 pb-2 pt-3 motion-safe:animate-fadeIn"
        >
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-surface-500">
            Top priorities
          </p>
          {board.topTasks.length ? (
            board.topTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => onTask(task)}
                className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-2.5 text-left hover:bg-surface-800/70"
              >
                <span className="truncate text-xs text-surface-300">
                  {task.title}
                </span>
                <Priority value={task.priority} />
              </button>
            ))
          ) : (
            <p className="py-3 text-xs text-surface-500">
              No open tasks.
            </p>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-surface-800/80 px-4 py-3">
        <Link
          href={`${url}/canvas`}
          className="flex items-center gap-2 text-xs text-surface-400 hover:text-surface-100"
        >
          <SquarePen size={14} />
          Canvas
          <ArrowUpRight size={12} />
        </Link>
        <div
          className="flex items-center gap-2"
          aria-label={`${board.activeUsers.length} people active in canvas`}
        >
          {board.activeUsers.length > 0 ? (
            <>
              <div className="flex -space-x-1.5">
                {board.activeUsers.slice(0, 3).map((person) => (
                  <span
                    key={person.userId}
                    title={`${person.displayName} · in canvas`}
                    className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-900 bg-surface-700 text-[9px] font-semibold text-surface-200"
                  >
                    {person.displayName
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part.charAt(0))
                      .join("")}
                    <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full border border-surface-900 bg-emerald-400" />
                  </span>
                ))}
              </div>
              <span className="text-[10px] text-surface-500">
                {board.activeUsers.length > 3
                  ? `+${board.activeUsers.length - 3}`
                  : "Live"}
              </span>
            </>
          ) : (
            <span className="text-[10px] text-surface-600">
              Quiet right now
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function WorkspaceHome() {
  const workspaceId = useParams().workspaceId as string;
  const { user } = useAuth();
  const toast = useToast();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [data, setData] = useState<WorkspaceHomeData | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [accessBoard, setAccessBoard] = useState<HomeBoard | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const generation = useRef(0);
  const reload = useCallback(
    async (background = false) => {
      const request = ++generation.current;
      if (!background) setRefreshing(true);
      try {
        const [ws, next] = await Promise.all([
          workspacesApi.getById(workspaceId),
          workspaceHomeApi.get(workspaceId),
        ]);
        if (request !== generation.current) return;
        setWorkspace(ws);
        setData(next);
        setError("");
        setAccessBoard((previous) =>
          previous && next.boards.some((board) => board.id === previous.id)
            ? previous
            : null,
        );
        setEditingTask((previous) =>
          previous && next.boards.some((board) => board.id === previous.boardId)
            ? previous
            : null,
        );
      } catch (err) {
        if (request !== generation.current) return;
        if (err instanceof ApiError && [401, 403, 404].includes(err.status)) {
          setData(null);
          setWorkspace(null);
        }
        setError(
          err instanceof ApiError && err.status < 500
            ? err.message
            : "Could not refresh this workspace. Check your connection and try again.",
        );
      } finally {
        if (request === generation.current) setRefreshing(false);
      }
    },
    [workspaceId],
  );
  useEffect(() => {
    setWorkspace(null);
    setData(null);
    setSearch("");
    setCreating(false);
    setEditingTask(null);
    setAccessBoard(null);
    void reload();
    const refresh = () => {
      if (document.visibilityState === "visible") void reload(true);
    };
    const timer = setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    return () => {
      // This is a request generation counter, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [reload]);
  useEffect(() => {
    if (user) setLastActiveWorkspace(user.id, workspaceId);
  }, [user, workspaceId]);
  const canManage = Boolean(data && ["OWNER", "ADMIN"].includes(data.role));
  const canEdit = Boolean(
    data && ["OWNER", "ADMIN", "EDITOR"].includes(data.role),
  );
  async function createBoard(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await boardsApi.create(workspaceId, { name: name.trim() });
      setName("");
      setCreating(false);
      await reload();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Could not create board. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function complete(task: Task) {
    if (completing) return;
    setCompleting(task.id);
    try {
      await tasksApi.update(workspaceId, task.boardId, task.id, {
        status: "DONE",
      });
      await reload(true);
      toast.success("Task completed");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Could not complete task. Try again.",
      );
    } finally {
      setCompleting(null);
    }
  }
  if (!workspace || !data)
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-14">
        {error ? (
          <div role="alert">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={() => void reload()}
              className="mt-4 text-sm text-primary-400"
            >
              Try again
            </button>
          </div>
        ) : (
          <div role="status" className="animate-pulse space-y-5">
            <div className="h-8 w-56 rounded bg-surface-800" />
            <div className="h-64 rounded-xl bg-surface-900" />
            <span className="sr-only">Loading workspace</span>
          </div>
        )}
      </div>
    );
  const filtered = data.boards.filter((board) =>
    board.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-5 border-b border-surface-800 pb-5">
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-surface-500">
            Your workspace
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {workspace.name}
          </h1>
          <p className="mt-2 text-sm text-surface-500">
          Your tasks and boards, in one place.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            aria-label="Refresh workspace"
            disabled={refreshing}
            onClick={() => void reload()}
            className="rounded-lg p-2 text-surface-500 hover:bg-surface-800"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
          {canManage && (
            <Link
              href={`/workspaces/${workspaceId}/manage`}
              className="flex items-center gap-2 rounded-lg border border-surface-700 px-3 py-2 text-xs text-surface-300 hover:bg-surface-800"
            >
              <Settings2 size={14} />
              Manage
            </Link>
          )}
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-amber-500/20 p-3 text-xs text-amber-400"
        >
          {error} Showing the last loaded view.
        </p>
      )}
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
        <section aria-labelledby="today-title">
          <div className="mb-5 flex items-center justify-between">
            <h2 id="today-title" className={`text-base font-semibold ${canEdit ? '' : 'gold-accent-text'}`}>
              My day{" "}
              <span className="ml-2 text-xs font-normal text-surface-500">
                {data.todayTasks.length}
              </span>
            </h2>
            <span className="text-xs text-surface-500">
              {new Date().toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <p className="mb-5 text-xs text-surface-500">
            Assigned to you · due today and overdue · priority first
          </p>
          {data.todayTasks.length ? (
            <div className="divide-y divide-surface-800 border-y border-surface-800">
              {data.todayTasks.map((task) => {
                const board = data.boards.find(
                  (item) => item.id === task.boardId,
                );
                const dayStart = new Date();
                dayStart.setHours(0, 0, 0, 0);
                const overdue =
                  task.dueDate && new Date(task.dueDate) < dayStart;
                return (
                  <div
                    key={task.id}
                    className="group flex items-start gap-3 py-4"
                  >
                    <button
                      disabled={!canEdit || completing !== null}
                      aria-label={`Complete ${task.title}`}
                      onClick={() => void complete(task)}
                      className="mt-0.5 shrink-0 rounded-full text-surface-600 hover:text-emerald-400 disabled:cursor-default disabled:opacity-40"
                    >
                      {completing === task.id ? (
                        <Check size={18} />
                      ) : (
                        <Circle size={18} />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => setEditingTask(task)}
                        className="max-w-full truncate text-left text-sm font-medium text-surface-200"
                      >
                        {task.title}
                      </button>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Link
                          href={`/workspaces/${workspaceId}/boards/${task.boardId}`}
                          className="text-xs text-surface-500"
                        >
                          {board?.name ?? "Board"}
                        </Link>
                        <span
                          className={`text-[11px] ${overdue ? "text-orange-400" : "text-surface-500"}`}
                        >
                          {overdue
                            ? `Overdue · ${new Date(task.dueDate!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                            : "Today"}
                        </span>
                      </div>
                    </div>
                    <Priority value={task.priority} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-surface-800 px-6 py-12 text-center">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface-900 text-emerald-400">
                <Check size={18} />
              </span>
              <h3 className="mt-4 text-sm font-medium text-surface-300">
                Nothing due today
              </h3>
              <p className="mx-auto mt-2 max-w-60 text-xs leading-relaxed text-surface-500">
                Tasks assigned to you with a due date will show up here. Explore
                a board to plan what comes next.
              </p>
            </div>
          )}
          {data.todayTasks.length === data.todayLimit && (
            <p className="mt-3 text-xs text-surface-500">
              Showing the first {data.todayLimit} tasks. Open a board to see
              more.
            </p>
          )}
          <section aria-labelledby="upcoming-title" className="mt-10">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="upcoming-title" className="text-base font-semibold">
                Upcoming
                <span className="ml-2 text-xs font-normal text-surface-500">
                  {(data.upcomingTasks ?? []).length}
                </span>
              </h2>
              <span className="text-xs text-surface-500">From tomorrow</span>
            </div>
            <p className="mb-5 text-xs text-surface-500">
              Assigned to you · nearest due date first
            </p>
            {data.upcomingTasks?.length ? (
              <ul className="divide-y divide-surface-800 border-y border-surface-800">
                {data.upcomingTasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-3 py-4">
                    <Circle size={16} aria-hidden="true" className="mt-1 shrink-0 text-surface-600" />
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => setEditingTask(task)}
                        className="max-w-full truncate text-left text-sm font-medium text-surface-200"
                      >
                        {task.title}
                      </button>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Link
                          href={`/workspaces/${workspaceId}/boards/${task.boardId}`}
                          className="text-xs text-surface-500"
                        >
                          {data.boards.find((board) => board.id === task.boardId)?.name ?? "Board"}
                        </Link>
                        {task.dueDate && (
                          <time dateTime={task.dueDate} className="text-[11px] text-surface-400">
                            {new Date(task.dueDate).toLocaleDateString(undefined, {
                              month: "short", day: "numeric", year: "numeric",
                            })}
                          </time>
                        )}
                      </div>
                    </div>
                    <Priority value={task.priority} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-surface-800 px-5 py-8 text-center text-xs text-surface-500">
                No upcoming tasks. Tasks assigned to you with future due dates will appear here.
              </p>
            )}
            {data.upcomingTasks?.length === data.upcomingLimit && (
              <p className="mt-3 text-xs text-surface-500">
                Showing your next {data.upcomingLimit} tasks. Open a board to see more.
              </p>
            )}
          </section>
        </section>
        <section aria-labelledby="boards-title">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id="boards-title" className="text-base font-semibold">
              Boards{" "}
              <span className="ml-2 text-xs font-normal text-surface-500">
                {data.boards.length}
              </span>
            </h2>
            {canEdit && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-200"
                >
                  <Upload size={13} />
                  Import
                </button>
                <button
                  onClick={() => setCreating(!creating)}
                  className="gold-accent flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium"
                >
                  <Plus size={14} />
                  New board
                </button>
              </div>
            )}
          </div>
          <label className="sr-only" htmlFor="board-search">
            Find a board
          </label>
          <input
            id="board-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a board…"
            className="mb-4 w-full rounded-lg border border-surface-800 bg-transparent px-3 py-2.5 text-xs outline-none placeholder:text-surface-600 focus:border-surface-500"
          />
          {creating && (
            <form
              onSubmit={createBoard}
              className="mb-4 rounded-xl border border-surface-700 bg-surface-900 p-4"
            >
              <div className="mb-3 flex justify-between">
                <label htmlFor="new-board-name" className="text-xs font-medium">
                  Board name
                </label>
                <button
                  type="button"
                  aria-label="Cancel new board"
                  onClick={() => setCreating(false)}
                >
                  <X size={14} />
                </button>
              </div>
              <input
                id="new-board-name"
                autoFocus
                maxLength={128}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Product launch"
                className="w-full rounded-md border border-surface-700 bg-surface-950 p-2 text-sm outline-none focus:border-primary-500"
              />
              <button
                disabled={saving || !name.trim()}
                className="mt-3 rounded-lg bg-primary-600 px-3 py-2 text-xs text-white disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create board"}
              </button>
            </form>
          )}
          <div className="space-y-3">
            {filtered.map((board) => (
              <BoardRow
                key={board.id}
                board={board}
                workspaceId={workspaceId}
                canManage={canManage}
                onAccess={() => setAccessBoard(board)}
                onTask={setEditingTask}
              />
            ))}
          </div>
          {!filtered.length && (
            <p className="rounded-xl border border-dashed border-surface-800 px-5 py-10 text-center text-xs text-surface-500">
              {search
                ? "No matching boards."
                : "No boards yet. Create one or import from Trello."}
            </p>
          )}
          <Link
            href={`/workspaces/${workspaceId}/library`}
            className="mt-5 inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-200"
          >
            Board library & archives
            <ArrowUpRight size={12} />
          </Link>
        </section>
      </div>
      {showImport && (
        <TrelloImportDialog
          workspaceId={workspaceId}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            void reload();
          }}
        />
      )}
      {accessBoard && (
        <BoardAccessDialog
          workspaceId={workspaceId}
          boardId={accessBoard.id}
          name={accessBoard.name}
          onClose={() => setAccessBoard(null)}
          onSaved={() => void reload()}
        />
      )}
      {editingTask && (
        <TaskModal
          mode="edit"
          workspaceId={workspaceId}
          boardId={editingTask.boardId}
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            setEditingTask(null);
            void reload();
          }}
          onDeleted={() => {
            setEditingTask(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}
