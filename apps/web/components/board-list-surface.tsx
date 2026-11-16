'use client';

import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';

export function BoardListSurface({ id, name, children }: { id: string; name: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} aria-label={`${name} task list`} className={`flex w-[min(18rem,calc(100vw-3rem))] shrink-0 flex-col self-start rounded-xl border bg-surface-900/80 shadow-sm transition-colors ${isOver ? 'border-primary-500/60' : 'border-surface-800'}`}>
      {children}
    </section>
  );
}
