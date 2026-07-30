'use client';

import { useCanvas, type CanvasObject } from '../_context/canvas-state';

type Props = {
  x: number;
  y: number;
  onClose: () => void;
};

export function ContextMenu({ x, y, onClose }: Props) {
  const { state, dispatch } = useCanvas();

  const selectedIds = state.selectedIds;

  function handleDelete() {
    dispatch({ type: 'DELETE_OBJECTS', payload: selectedIds });
    onClose();
  }

  function handleBringToFront() {
    dispatch({ type: 'BRING_TO_FRONT', payload: selectedIds });
    onClose();
  }

  function handleSendToBack() {
    dispatch({ type: 'SEND_TO_BACK', payload: selectedIds });
    onClose();
  }

  async function handleCopy() {
    const objects = state.objects.filter(o => selectedIds.includes(o.id));
    await navigator.clipboard.writeText(JSON.stringify(objects));
    onClose();
  }

  function handleDuplicate() {
    const objects = state.objects.filter(o => selectedIds.includes(o.id));
    const newObjects: CanvasObject[] = objects.map(o => ({
      ...o,
      id: crypto.randomUUID(),
      x: o.x + 20,
      y: o.y + 20,
      zIndex: state.objects.length + o.zIndex,
    }));
    for (const obj of newObjects) {
      dispatch({ type: 'ADD_OBJECT', payload: obj });
    }
    onClose();
  }

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 min-w-[160px] rounded-xl border border-surface-700 bg-surface-900 py-1 shadow-2xl"
        style={{ left: x, top: y }}
      >
        <button onClick={handleDuplicate} className="flex w-full items-center px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800">Duplicate</button>
        <button onClick={handleCopy} className="flex w-full items-center px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800">Copy</button>
        <div className="my-1 border-t border-surface-700" />
        <button onClick={handleDelete} className="flex w-full items-center px-3 py-1.5 text-xs text-red-400 hover:bg-surface-800">Delete</button>
        <div className="my-1 border-t border-surface-700" />
        <button onClick={handleBringToFront} className="flex w-full items-center px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800">Bring to Front</button>
        <button onClick={handleSendToBack} className="flex w-full items-center px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800">Send to Back</button>
      </div>
    </>
  );
}
