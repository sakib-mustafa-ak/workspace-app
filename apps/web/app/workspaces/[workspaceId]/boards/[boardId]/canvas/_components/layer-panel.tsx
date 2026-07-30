'use client';

import { useCanvas } from '../_context/canvas-state';

export function LayerPanel() {
  const { state, dispatch } = useCanvas();

  const sorted = [...state.objects].sort((a, b) => b.zIndex - a.zIndex);

  function handleSelect(id: string) {
    dispatch({ type: 'SELECT', payload: [id] });
  }

  return (
    <div className="w-56 shrink-0 border-l border-surface-800 bg-surface-900/50">
      <div className="border-b border-surface-800 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-400">Layers</h3>
      </div>
      <div className="space-y-0.5 p-2">
        {sorted.map((obj) => (
          <button
            key={obj.id}
            onClick={() => handleSelect(obj.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              state.selectedIds.includes(obj.id)
                ? 'bg-primary-600/20 text-primary-400'
                : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
            }`}
          >
            <span className="truncate">{obj.type}{obj.text ? `: ${obj.text}` : ''}</span>
            <span className="ml-auto text-surface-600">z:{obj.zIndex}</span>
          </button>
        ))}
        {sorted.length === 0 && (
          <p className="py-4 text-center text-xs text-surface-500">No objects</p>
        )}
      </div>
    </div>
  );
}
