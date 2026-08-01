'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CanvasProvider } from './_context/canvas-provider';
import { CanvasSurface } from './_components/canvas-surface';
import { Toolbar } from './_components/toolbar';

export default function CanvasPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const boardId = params.boardId as string;

  return (
    <CanvasProvider>
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
        </div>
        <Toolbar />
        <CanvasSurface />
      </div>
    </CanvasProvider>
  );
}
