'use client';

import { useState } from 'react';
import { useCanvas, type CanvasObject } from '../_context/canvas-state';
import { useCanvasSync } from '../_context/canvas-sync';

type Props = {
  x: number;
  y: number;
  onClose: () => void;
  onEditText?: () => void;
};

export function ContextMenu({ x, y, onClose, onEditText }: Props) {
  const { state, dispatch } = useCanvas();
  const { persistCreate, persistUpdateMany, persistDelete } =
    useCanvasSync();
  const [pasteError, setPasteError] = useState(false);

  const selectedIds = state.selectedIds;

  function handleDelete() {
    dispatch({ type: 'DELETE_OBJECTS', payload: selectedIds });
    void persistDelete(selectedIds);
    onClose();
  }

  function handleBringToFront() {
    dispatch({ type: 'BRING_TO_FRONT', payload: selectedIds });
    const z = Math.max(...state.objects.map(o => o.zIndex)) + 1;
    const updated = state.objects
      .filter(o => selectedIds.includes(o.id))
      .map(o => ({ ...o, zIndex: z }));
    void persistUpdateMany(updated);
    onClose();
  }

  function handleSendToBack() {
    dispatch({ type: 'SEND_TO_BACK', payload: selectedIds });
    const z = Math.min(...state.objects.map(o => o.zIndex)) - 1;
    const updated = state.objects
      .filter(o => selectedIds.includes(o.id))
      .map(o => ({ ...o, zIndex: z }));
    void persistUpdateMany(updated);
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
      void persistCreate(obj);
    }
    onClose();
  }

  async function handlePaste() {
    try {
      const raw = await navigator.clipboard.readText();
      const objects = JSON.parse(raw) as CanvasObject[];
      if (!Array.isArray(objects) || objects.length === 0) {
        setPasteError(true);
        return;
      }
      const now = Date.now();
      const newObjects: CanvasObject[] = objects.map(o => ({
        ...o,
        id: `${crypto.randomUUID()}-${now}`,
        x: o.x + 24,
        y: o.y + 24,
        zIndex: state.objects.length + o.zIndex,
      }));
      for (const obj of newObjects) {
        dispatch({ type: 'ADD_OBJECT', payload: obj });
        void persistCreate(obj);
      }
      onClose();
    } catch {
      setPasteError(true);
    }
  }

  if (selectedIds.length === 0) return null;

  const left = Math.min(x, Math.max(0, window.innerWidth - 176));
  const top = Math.min(y, Math.max(0, window.innerHeight - 220));

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 min-w-[160px] rounded-xl border border-surface-700 bg-surface-900 py-1 shadow-xl"
        style={{ left, top }}
      >
        <button onClick={handleDuplicate} className="flex w-full items-center px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800">Duplicate</button>
        <button onClick={handleCopy} className="flex w-full items-center px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800">Copy</button>
        <button onClick={handlePaste} className="flex w-full items-center px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800">Paste</button>
        {onEditText && (
          <>
            <div className="my-1 border-t border-surface-700" />
            <button onClick={() => { onEditText(); onClose(); }} className="flex w-full items-center px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800">Edit text</button>
          </>
        )}
        <div className="my-1 border-t border-surface-700" />
        <button onClick={handleDelete} className="flex w-full items-center px-3 py-1.5 text-xs text-red-400 hover:bg-surface-800">Delete</button>
        <div className="my-1 border-t border-surface-700" />
        <button onClick={handleBringToFront} className="flex w-full items-center px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800">Bring to Front</button>
        <button onClick={handleSendToBack} className="flex w-full items-center px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800">Send to Back</button>
        {pasteError && (
          <p className="border-t border-surface-700 px-3 py-1.5 text-[10px] text-red-400">Clipboard is empty or invalid</p>
        )}
      </div>
    </>
  );
}
