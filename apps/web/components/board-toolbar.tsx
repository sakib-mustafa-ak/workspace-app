'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Archive, Calendar, ChevronLeft, Columns3, FileText, MessageSquare, MoreHorizontal, Pencil, Search, Sparkles, SquarePen, Trash2, X } from 'lucide-react';
import type { Board } from '@/lib/boards';
import { BoardUploadButton } from './board-upload-button';

type Props = {
  board: Board;
  workspaceId: string;
  workspaceName: string;
  calendar: boolean;
  comments: boolean;
  search: string;
  onSearch: (value: string) => void;
  onView: (calendar: boolean) => void;
  onComments: () => void;
  onFiles: () => void;
  onSummary: () => void;
  onIdeas: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
};

export function BoardToolbar(props: Props) {
  const { board, workspaceId, workspaceName, calendar, comments, search } = props;
  const pathname = usePathname();
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('workbench:title', { detail: { href: pathname, title: board.name } }));
  }, [pathname, board.name]);
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) menuRef.current.open = false;
    }
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);
  function action(callback: () => void) {
    if (menuRef.current) menuRef.current.open = false;
    callback();
  }
  const itemClass = 'flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-xs text-surface-300 hover:bg-surface-800 focus-visible:outline-primary-400';
  return (
    <header className="relative z-20 flex shrink-0 flex-wrap items-center gap-2 border-b border-surface-800 bg-surface-950 px-3 py-2">
      <div className="contents">
        <div className="mr-auto flex min-w-0 flex-wrap items-center gap-2">
          <Link href={`/workspaces/${workspaceId}`} className="inline-flex max-w-36 items-center gap-1 text-xs text-surface-500 hover:text-surface-200">
            <ChevronLeft size={12} className="shrink-0" /><span className="truncate">{workspaceName}</span>
          </Link>
          <span className="text-surface-600" aria-hidden="true">/</span>
          <h1 className="max-w-64 truncate font-semibold text-surface-100" style={{ fontSize: '14px' }} title={board.description || board.name}>{board.name}</h1>
        </div>
        <div className="order-2 flex shrink-0 items-center gap-1">
          <Link href={`/workspaces/${workspaceId}/boards/${board.id}/canvas`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-surface-300 hover:bg-surface-800">
            <SquarePen size={15} />Canvas
          </Link>
          <button type="button" onClick={props.onComments} aria-pressed={comments} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${comments ? 'bg-surface-800 text-surface-100' : 'text-surface-400 hover:bg-surface-800'}`}>
            <MessageSquare size={15} /><span className="hidden sm:inline">Comments</span><span className="sr-only sm:hidden">Comments</span>
          </button>
          <details ref={menuRef} className="relative" onKeyDown={(event) => {
            if (event.key === 'Escape' && menuRef.current) {
              menuRef.current.open = false;
              menuRef.current.querySelector('summary')?.focus();
            }
          }}>
            <summary aria-label="Board tools" className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-surface-700 px-3 py-2 text-xs text-surface-300 hover:bg-surface-800 [&::-webkit-details-marker]:hidden">
              <MoreHorizontal size={16} />Tools
            </summary>
            <div className="absolute right-0 top-full z-40 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-xl border border-surface-700 bg-surface-900 p-2 shadow-xl">
              <p className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-surface-500">Board tools</p>
              <button type="button" onClick={() => action(props.onFiles)} className={itemClass}><FileText size={14} />Board files</button>
              <BoardUploadButton workspaceId={workspaceId} boardId={board.id} onUploaded={() => action(props.onFiles)} />
              <div className="my-2 border-t border-surface-800" />
              <button type="button" onClick={() => action(props.onSummary)} className={itemClass}><Sparkles size={14} />Summarize board</button>
              <button type="button" onClick={() => action(props.onIdeas)} className={itemClass}><Sparkles size={14} />Generate ideas</button>
              <div className="my-2 border-t border-surface-800" />
              <button type="button" onClick={() => action(props.onEdit)} className={itemClass}><Pencil size={14} />Edit board</button>
              <button type="button" onClick={() => action(props.onArchive)} className={itemClass}><Archive size={14} />{board.archivedAt ? 'Restore board' : 'Archive board'}</button>
              <button type="button" onClick={() => action(props.onDelete)} className={`${itemClass} text-red-400`}><Trash2 size={14} />Delete board</button>
            </div>
          </details>
        </div>
      </div>
      <div className="contents">
        <div role="group" aria-label="Board view" className="order-1 flex items-center gap-1 rounded-sm bg-surface-900 p-0.5">
          <button type="button" aria-pressed={!calendar} onClick={() => props.onView(false)} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs ${!calendar ? 'bg-surface-700 text-surface-100' : 'text-surface-500 hover:text-surface-200'}`}><Columns3 size={14} />Board</button>
          <button type="button" aria-pressed={calendar} onClick={() => props.onView(true)} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs ${calendar ? 'bg-surface-700 text-surface-100' : 'text-surface-500 hover:text-surface-200'}`}><Calendar size={14} />Calendar</button>
        </div>
        <div className="relative order-3 w-full lg:w-44">
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input aria-label="Find a task" value={search} onChange={(event) => props.onSearch(event.target.value)} placeholder="Find a task…" className="w-full rounded-lg border border-surface-800 bg-transparent py-2 pl-9 pr-8 text-xs text-surface-200 outline-none placeholder:text-surface-600 focus:border-surface-500" />
          {search && <button type="button" aria-label="Clear task search" onClick={() => props.onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-surface-400 hover:text-surface-100"><X size={12} /></button>}
        </div>
      </div>
    </header>
  );
}
