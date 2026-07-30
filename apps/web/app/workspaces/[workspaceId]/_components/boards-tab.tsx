'use client';

import Link from 'next/link';
import { Columns, ExternalLink } from 'lucide-react';
import type { Board } from '@/lib/boards';

type Props = {
  workspaceId: string;
  boards: Board[];
};

export function BoardsTab({ workspaceId, boards }: Props) {
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-surface-400">{boards.length} board(s)</p>
        <Link
          href={`/workspaces/${workspaceId}/boards`}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-500"
        >
          <Columns size={14} />
          View all boards
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.filter((b) => b.status !== 'ARCHIVED').map((board) => (
          <Link
            key={board.id}
            href={`/workspaces/${workspaceId}/boards/${board.id}`}
            className="group rounded-xl border border-surface-800 bg-surface-900 p-5 transition-colors hover:border-surface-700"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10 text-sm font-bold text-emerald-400">
                {board.name.charAt(0).toUpperCase()}
              </div>
              <ExternalLink size={14} className="text-surface-600 opacity-0 group-hover:opacity-100" />
            </div>
            <h3 className="mt-3 font-medium">{board.name}</h3>
            <p className="mt-1 text-xs text-surface-500">{board.description || 'No description'}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
