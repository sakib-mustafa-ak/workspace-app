"use client";

import { useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Columns3,
  Folder,
  List,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { workspacesApi, type Workspace } from "@/lib/workspaces";
import { boardsApi, type Board, type BoardColumn } from "@/lib/boards";

const rowClass =
  "flex min-w-0 items-center gap-2 py-1.5 pr-2 text-xs text-surface-400 hover:bg-surface-800/60 hover:text-surface-200";

function BoardRow({
  board,
  version,
  onLabel,
}: {
  board: Board;
  version: number;
  onLabel: (href: string, label: string) => void;
}) {
  const pathname = usePathname();
  const href = `/workspaces/${board.workspaceId}/boards/${board.id}`;
  const active = pathname === href || pathname.startsWith(href + "/");
  const [open, setOpen] = useState(active);
  const [columns, setColumns] = useState<BoardColumn[] | null>(null);
  const [error, setError] = useState(false);
  const id = useId();
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  useEffect(() => {
    onLabel(href, board.name);
    onLabel(href + "/canvas", `${board.name} · Canvas`);
  }, [href, board.name, onLabel]);
  useEffect(() => {
    if (!open) return;
    let current = true;
    setError(false);
    setColumns(null);
    boardsApi
      .getColumns(board.workspaceId, board.id)
      .then((items) => {
        if (current)
          setColumns(
            items
              .filter(
                (column) => column.status === "ACTIVE" && !column.archivedAt,
              )
              .sort((a, b) => a.position - b.position),
          );
      })
      .catch(() => {
        if (current) {
          setColumns([]);
          setError(true);
        }
      });
    return () => {
      current = false;
    };
  }, [open, board.id, board.workspaceId, version]);
  return (
    <li>
      <div
        className={`${rowClass} pl-5 ${active ? "bg-surface-800/70 text-surface-100" : ""}`}
      >
        <button
          type="button"
          aria-label={`${open ? "Collapse" : "Expand"} ${board.name} lists`}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          className="flex h-6 w-6 shrink-0 items-center justify-center"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <Columns3 size={13} className="shrink-0 text-primary-400" />
        <Link
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className="min-w-0 flex-1 truncate"
          title={board.name}
        >
          {board.name}
        </Link>
      </div>
      {open && (
        <ul id={id} className="ml-9 border-l border-surface-800">
          {!columns ? (
            <li className="px-4 py-2 text-xs text-surface-500">
              <Loader2 size={12} className="animate-spin" />
            </li>
          ) : error ? (
            <li className="px-4 py-2 text-xs text-red-400">
              Could not load lists.
            </li>
          ) : columns.length === 0 ? (
            <li className="px-4 py-2 text-xs text-surface-500">No lists yet</li>
          ) : (
            columns.map((column) => (
              <li key={column.id}>
                <Link
                  href={`${href}#list-${column.id}`}
                  className={`${rowClass} pl-4`}
                  title={column.name}
                >
                  <List size={12} className="shrink-0" />
                  <span className="truncate">{column.name}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </li>
  );
}

function WorkspaceRow({
  workspace,
  version,
  onLabel,
}: {
  workspace: Workspace;
  version: number;
  onLabel: (href: string, label: string) => void;
}) {
  const pathname = usePathname();
  const href = `/workspaces/${workspace.id}`;
  const active = pathname === href || pathname.startsWith(href + "/");
  const [open, setOpen] = useState(active);
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [error, setError] = useState(false);
  const id = useId();
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  useEffect(() => {
    onLabel(href, workspace.name);
    onLabel(href + "/boards", workspace.name);
  }, [href, workspace.name, onLabel]);
  useEffect(() => {
    if (!open) return;
    let current = true;
    setError(false);
    setBoards(null);
    boardsApi
      .list(workspace.id)
      .then((items) => {
        if (current)
          setBoards(
            items
              .filter((board) => board.status === "ACTIVE" && !board.archivedAt)
              .sort((a, b) => a.position - b.position),
          );
      })
      .catch(() => {
        if (current) {
          setBoards([]);
          setError(true);
        }
      });
    return () => {
      current = false;
    };
  }, [open, workspace.id, version]);
  return (
    <li>
      <div
        className={`${rowClass} pl-1 ${pathname === href ? "bg-surface-800/70 text-surface-100" : ""}`}
      >
        <button
          type="button"
          aria-label={`${open ? "Collapse" : "Expand"} ${workspace.name} boards`}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          className="flex h-6 w-6 shrink-0 items-center justify-center"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <Folder size={14} className="shrink-0 text-primary-400" />
        <Link
          href={href}
          className="min-w-0 flex-1 truncate"
          title={workspace.name}
        >
          {workspace.name}
        </Link>
      </div>
      {open && (
        <ul id={id}>
          {!boards ? (
            <li className="px-8 py-2 text-xs text-surface-500">
              Loading boards…
            </li>
          ) : error ? (
            <li className="px-8 py-2 text-xs text-red-400">
              Board access unavailable.
            </li>
          ) : boards.length === 0 ? (
            <li className="px-8 py-2 text-xs text-surface-500">
              No accessible boards
            </li>
          ) : (
            boards.map((board) => (
              <BoardRow
                key={board.id}
                board={board}
                version={version}
                onLabel={onLabel}
              />
            ))
          )}
        </ul>
      )}
    </li>
  );
}

export function WorkbenchExplorer({
  onClose,
  onLabel,
}: {
  onClose: () => void;
  onLabel: (href: string, label: string) => void;
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  useEffect(() => {
    let current = true;
    setError(false);
    workspacesApi
      .list()
      .then((items) => {
        if (current)
          setWorkspaces(items.filter((item) => item.status === "ACTIVE"));
      })
      .catch(() => {
        if (current) {
          setError(true);
          setWorkspaces([]);
        }
      });
    return () => {
      current = false;
    };
  }, [version]);
  return (
    <nav
      aria-label="Workspace explorer"
      className="flex h-full min-h-0 flex-col bg-workbench-chrome"
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-surface-800 px-3">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-surface-400">
          Explorer
        </h2>
        <div className="flex">
          <button
            type="button"
            aria-label="Refresh Explorer"
            title="Refresh Explorer"
            onClick={() => setVersion(version + 1)}
            className="flex h-7 w-7 items-center justify-center text-surface-500 hover:text-surface-200"
          >
            <RefreshCw size={12} />
          </button>
          <button
            type="button"
            aria-label="Hide Explorer"
            title="Hide Explorer"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center text-surface-500 hover:text-surface-200"
          >
            <X size={13} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-2">
        {!workspaces ? (
          <p role="status" className="px-4 py-3 text-xs text-surface-500">
            Loading workspaces…
          </p>
        ) : error ? (
          <p role="alert" className="px-4 py-3 text-xs text-red-400">
            Could not load workspaces. Use Refresh to retry.
          </p>
        ) : workspaces.length === 0 ? (
          <Link
            href="/dashboard"
            className="block px-4 py-3 text-xs text-primary-400"
          >
            Create your first workspace
          </Link>
        ) : (
          <ul>
            {workspaces.map((workspace) => (
              <WorkspaceRow
                key={workspace.id}
                workspace={workspace}
                version={version}
                onLabel={onLabel}
              />
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
