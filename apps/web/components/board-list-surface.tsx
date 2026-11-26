'use client';

import { useEffect, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { WorkbenchResizeHandle } from '@/components/workbench-resize-handle';
import { useWorkbenchSize } from '@/hooks/use-workbench-size';

export function BoardListSurface({ id, name, children }: { id: string; name: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [width, setWidth] = useWorkbenchSize(`list:${id}`, 288, 220, 520);
  useEffect(() => {
    const scroll = () => {
      if (location.hash === `#list-${id}`) document.getElementById(`list-${id}`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' });
    };
    scroll(); window.addEventListener('hashchange', scroll);
    return () => window.removeEventListener('hashchange', scroll);
  }, [id]);
  return (
    <section id={`list-${id}`} ref={setNodeRef} aria-label={`${name} task list`} style={{ width: `min(${width}px, calc(100vw - 5rem))` }} className={`relative flex shrink-0 flex-col self-start rounded-xl border bg-surface-900/80 shadow-sm transition-colors ${isOver ? 'border-primary-500/60' : 'border-surface-800'}`}>
      {children}
      <div className="absolute bottom-0 right-0 top-0 flex"><WorkbenchResizeHandle label={`Resize ${name} list`} value={width} min={220} max={520} onChange={setWidth} onReset={() => setWidth(288)} /></div>
    </section>
  );
}
