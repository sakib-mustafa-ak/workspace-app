"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Columns3, Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { useFocusTrap } from "@/hooks/use-focus-trap";

type SearchItem = { id: string; title: string; workspaceId: string; boardId?: string };
type SearchResults = { boards: SearchItem[]; tasks: SearchItem[] };

export function WorkbenchSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [error, setError] = useState("");
  const trap = useFocusTrap(true, onClose);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!query.trim()) return;
      void api.get<SearchResults>(`/search?q=${encodeURIComponent(query.trim())}`).then((next) => {
        if (active) setResults(next);
      }).catch(() => { if (active) setError("Search could not load. Try again."); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-4 pt-[15vh]" onClick={onClose}>
      <div ref={trap} role="dialog" aria-modal="true" aria-label="Search boards and tasks" className="w-full max-w-xl rounded-sm border border-surface-700 bg-surface-950 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-surface-800 px-3 py-2">
          <Search size={16} className="shrink-0 text-surface-500" />
          <input aria-label="Search query" placeholder="Search boards and tasks…" value={query} onChange={(event) => { setQuery(event.target.value); setResults(null); setError(""); }} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" />
          <button type="button" aria-label="Close search" title="Close search" onClick={onClose} className="flex h-8 w-8 items-center justify-center text-surface-500 hover:text-surface-200"><X size={16} /></button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2" aria-live="polite">
          {!query.trim() ? <p className="p-3 text-xs text-surface-500">Find work across your accessible workspaces.</p>
            : error ? <p role="alert" className="p-3 text-xs text-red-400">{error}</p>
            : !results ? <p role="status" className="p-3 text-xs text-surface-500">Searching…</p>
            : results.boards.length + results.tasks.length === 0 ? <p className="p-3 text-xs text-surface-500">No matching boards or tasks.</p>
            : <ul>{[...results.boards, ...results.tasks].map((item) => (
              <li key={`${item.boardId ? 'task' : 'board'}:${item.id}`}>
                <Link href={`/workspaces/${item.workspaceId}/boards/${item.boardId ?? item.id}`} onClick={onClose} className="flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm text-surface-300 hover:bg-surface-800"><Columns3 size={14} className="shrink-0 text-primary-400" /><span className="min-w-0 flex-1 truncate">{item.title}</span><span className="text-[10px] text-surface-500">{item.boardId ? 'Task' : 'Board'}</span></Link>
              </li>
            ))}</ul>}
        </div>
      </div>
    </div>
  );
}
