'use client';

import { ArrowLeft, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CanvasProvider } from './_context/canvas-provider';
import { CanvasSyncProvider, useCanvasSync } from './_context/canvas-sync';
import { CanvasSurface } from './_components/canvas-surface';
import { Toolbar } from './_components/toolbar';

function PresenceChips() {
  const { presence } = useCanvasSync();
  if (presence.length === 0) return null;
  return (
    <div className="ml-2 flex items-center gap-1.5">
      <Users size={13} className="text-surface-600" />
      {presence.slice(0, 5).map((p) => (
        <div
          key={p.userId}
          title={p.displayName}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-700 text-[10px] font-bold text-surface-200"
        >
          {p.displayName.charAt(0).toUpperCase()}
        </div>
      ))}
      {presence.length > 5 && (
        <span className="text-xs text-surface-500">+{presence.length - 5}</span>
      )}
    </div>
  );
}

export default function CanvasPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const boardId = params.boardId as string;

  return (
    <CanvasProvider>
      <CanvasSyncProvider boardId={boardId}>
        <div className="relative flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-surface-800 px-4 py-2">
            <Link
              href={`/workspaces/${workspaceId}/boards/${boardId}`}
              className="flex items-center gap-1 text-xs text-surface-400 hover:text-surface-200"
            >
              <ArrowLeft size={14} />
              Back to board
            </Link>
            <span className="text-xs text-surface-600">|</span>
            <span className="text-label text-surface-500">Canvas</span>
            <PresenceChips />
          </div>
          <Toolbar />
          <CanvasSurface />
        </div>
      </CanvasSyncProvider>
    </CanvasProvider>
  );
}
