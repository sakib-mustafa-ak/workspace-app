'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CanvasProvider } from './_context/canvas-provider';
import { CanvasSyncProvider, useCanvasSync } from './_context/canvas-sync';
import { CanvasSurface } from './_components/canvas-surface';
import { Toolbar } from './_components/toolbar';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { workspacesApi } from '@/lib/workspaces';
import { boardsApi } from '@/lib/boards';

function CanvasLoadError() {
  const { loadError, retryLoad } = useCanvasSync();
  if (!loadError) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      <div className="pointer-events-auto max-w-md rounded-xl border border-red-500/20 bg-surface-900/95 px-6 py-4 shadow-xl">
        <p className="text-sm font-medium text-red-400">{loadError}</p>
        <button
          onClick={loadError.startsWith('Board access') ? () => window.location.reload() : retryLoad}
          className="mt-2 rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-500"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function CanvasHeader() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const boardId = params.boardId as string;

  const [workspace, setWorkspace] = useState<{ name: string } | null>(null);
  const [board, setBoard] = useState<{ name: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      workspacesApi.getById(workspaceId),
      boardsApi.getById(workspaceId, boardId),
    ]).then(([ws, brd]) => {
      if (cancelled) return;
      setWorkspace(ws);
      setBoard(brd);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [workspaceId, boardId]);

  return (
    <Breadcrumbs
      items={[
        { label: workspace?.name || 'Workspace', href: `/workspaces/${workspaceId}` },
        { label: 'Boards', href: `/workspaces/${workspaceId}/boards` },
        { label: board?.name || 'Board', href: `/workspaces/${workspaceId}/boards/${boardId}` },
      ]}
      currentLabel="Canvas"
    />
  );
}

export default function CanvasPage() {
  return (
    <CanvasProvider>
      <CanvasSyncProvider boardId={useParams().boardId as string}>
        <div className="relative flex h-full flex-col">
          <div className="border-b border-surface-800 px-4 py-2">
            <CanvasHeader />
          </div>
          <Toolbar />
          <CanvasLoadError />
          <CanvasSurface />
        </div>
      </CanvasSyncProvider>
    </CanvasProvider>
  );
}
