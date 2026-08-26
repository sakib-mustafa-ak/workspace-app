'use client';

import Link from 'next/link';
import { Columns, ExternalLink } from 'lucide-react';
import type { Board } from '@/lib/boards';

type Props = {
  workspaceId: string;
  boards: Board[];
};

export function BoardsTab({ workspaceId, boards }: Props) {
  const activeBoards = boards.filter((b) => b.status !== 'ARCHIVED');
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-surface-400">{activeBoards.length} board(s)</p>
        <Link
          href={`/workspaces/${workspaceId}/boards`}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-500"
        >
          <Columns size={14} />
          View all boards
        </Link>
      </div>
      {activeBoards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-700/50 bg-surface-900/30 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-800">
            <Columns size={22} className="text-surface-500" />
          </div>
          <p className="mt-3 text-sm font-medium text-surface-400">No boards yet</p>
          <p className="mt-1 text-xs text-surface-500">
            Create a board to organize tasks for this workspace
          </p>
          <Link
            href={`/workspaces/${workspaceId}/boards`}
            className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-500"
          >
            Create a board
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeBoards.map((board) => (
            <Link
              key={board.id}
              href={`/workspaces/${workspaceId}/boards/${board.id}`}
              className="group rounded-xl border border-surface-800 bg-surface-900 p-4 transition-colors hover:border-surface-700"
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
      )}
    </div>
  );
}
