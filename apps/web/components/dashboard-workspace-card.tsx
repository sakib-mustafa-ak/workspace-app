'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown, LayoutGrid, Loader2, Users } from 'lucide-react';
import { boardsApi, type Board } from '@/lib/boards';
import type { Workspace } from '@/lib/workspaces';

export function DashboardWorkspaceCard({ workspace: ws }: { workspace: Workspace }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  const hovered = useRef(false);

  async function loadBoards() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError(false);
    try {
      const result = await boardsApi.list(ws.id);
      setBoards(result.filter((board) => board.status === 'ACTIVE').sort((a, b) => a.position - b.position));
    } catch {
      setError(true);
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  function showPreview() {
    setOpen(true);
    if (boards === null) void loadBoards();
  }

  return (
    <article
      className={`rounded-xl border bg-surface-900/40 transition-colors duration-200 ${open ? 'border-surface-600' : 'border-surface-800'}`}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') return;
        hovered.current = true;
        showPreview();
      }}
      onPointerLeave={(event) => {
        hovered.current = false;
        if (!event.currentTarget.contains(document.activeElement)) setOpen(false);
      }}
      onFocusCapture={(event) => {
        // The toggle opens on activation, not focus (important for touch taps).
        if (event.target instanceof HTMLElement && event.target.closest('button')) return;
        if (!event.currentTarget.contains(event.relatedTarget)) showPreview();
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && !hovered.current) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
          event.stopPropagation();
        }
      }}
    >
      <div className="flex items-center gap-2 p-4">
        <Link href={`/workspaces/${ws.id}`} className="flex min-w-0 flex-1 items-center gap-4 rounded-lg focus-visible:outline-2 focus-visible:outline-primary-400">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-surface-700 bg-surface-800/50 text-sm font-semibold text-surface-300">
            {ws.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-surface-200">{ws.name}</h3>
            {ws.description && <p className="mt-1 line-clamp-1 text-xs text-surface-500">{ws.description}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-surface-500">
              <span className="flex items-center gap-1"><Users size={11} />{ws.memberCount ?? 1} member{(ws.memberCount ?? 1) !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1"><LayoutGrid size={11} />{ws.boardCount ?? 0} board{(ws.boardCount ?? 0) !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </Link>
        <button
          type="button"
          aria-label={`${open ? 'Hide' : 'Show'} boards in ${ws.name}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            if (open) setOpen(false);
            else showPreview();
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200 focus-visible:outline-2 focus-visible:outline-primary-400"
        >
          <ChevronDown size={16} className={`transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div className={`grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div id={panelId} inert={!open} aria-hidden={!open} className="min-h-0 overflow-hidden">
          <div className="mx-4 mb-4 border-t border-surface-800 pt-3">
            <p className="mb-2 text-xs font-medium text-surface-500">Boards</p>
            {loading ? (
              <p role="status" className="flex items-center gap-2 py-2 text-xs text-surface-400"><Loader2 size={13} className="animate-spin motion-reduce:animate-none" />Loading boards…</p>
            ) : error ? (
              <div className="flex items-center justify-between gap-3 py-2 text-xs">
                <p role="alert" className="text-surface-400">Could not load boards.</p>
                <button type="button" onClick={() => void loadBoards()} className="rounded px-2 py-1 text-primary-400 hover:bg-surface-800">Try again</button>
              </div>
            ) : boards?.length ? (
              <ul aria-label={`Boards in ${ws.name}`} className="max-h-64 space-y-1 overflow-y-auto">
                {boards.map((board) => (
                  <li key={board.id}>
                    <Link href={`/workspaces/${ws.id}/boards/${board.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs text-surface-300 transition-colors hover:bg-surface-800/60 focus-visible:outline-2 focus-visible:outline-primary-400">
                      <LayoutGrid size={14} className="shrink-0 text-surface-500" />
                      <span className="min-w-0 flex-1 truncate">{board.name}</span>
                      <ArrowUpRight size={13} className="shrink-0 text-surface-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-xs text-surface-500">No active boards yet. Open this workspace to create one.</p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
