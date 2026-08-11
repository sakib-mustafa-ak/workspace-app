'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useCanvas, type ToolType, type CanvasObject } from '../_context/canvas-state';
import { useCanvasSync } from '../_context/canvas-sync';
import { getStoredUser } from '@/lib/auth';
import { renderFrame } from './canvas-renderer';
import { hitTest, hitTestHandle, handleResize } from './selection-manager';
import { ContextMenu } from './context-menu';
import { LayerPanel } from './layer-panel';

export function CanvasSurface() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useCanvas();
  const { persistCreate, persistUpdate, persistUpdateMany, persistDelete, remoteCursors, emitCursor, objectLocks, requestLock, releaseLock } =
    useCanvasSync();

  const drawingRef = useRef<string | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const panningRef = useRef(false);
  const panOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const spaceRef = useRef(false);

  const dragMode = useRef<'none' | 'draw' | 'move' | 'resize'>('none');
  const resizeHandle = useRef<string | null>(null);
  const resizeIdRef = useRef<string | null>(null);
  const moveIdsRef = useRef<string[]>([]);
  const moveStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectedSnapshot = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingText, setEditingText] = useState<{ id: string; text: string } | null>(null);

  const lockedObjectIds = useRef(new Set<string>());
  lockedObjectIds.current = new Set(
    [...objectLocks.entries()]
      .filter(([, lock]) => lock.userId !== getStoredUser()?.id)
      .map(([id]) => id),
  );

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const openPicker = () => fileInputRef.current?.click();
    window.addEventListener('canvas:upload-image', openPicker);
    return () => window.removeEventListener('canvas:upload-image', openPicker);
  }, []);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const pos = screenToCanvas(
          (containerRef.current?.clientWidth || 400) / 2,
          (containerRef.current?.clientHeight || 300) / 2,
        );
        const newObj: CanvasObject = {
          id: crypto.randomUUID(),
          type: 'image',
          x: pos.x - img.width / 2 / state.zoom,
          y: pos.y - img.height / 2 / state.zoom,
          width: img.width / state.zoom,
          height: img.height / state.zoom,
          rotation: 0,
          fill: '#ffffff',
          stroke: '#000000',
          strokeWidth: 0,
          opacity: 1,
          imageData: dataUrl,
          zIndex: state.objects.length,
        };
        dispatch({ type: 'ADD_OBJECT', payload: newObj });
        dispatch({ type: 'SELECT', payload: [newObj.id] });
        void persistCreate(newObj);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleDoubleClick(e: React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const pos = screenToCanvas(sx, sy);

    const sorted = [...state.objects].sort((a, b) => b.zIndex - a.zIndex);
    for (const obj of sorted) {
      if (lockedObjectIds.current.has(obj.id)) continue;
      if ((obj.type === 'text' || obj.type === 'stickyNote') && hitTest(pos, obj, state.zoom)) {
        startTextEdit(obj.id);
        return;
      }
    }
  }

  function handleTextEditCommit() {
    if (!editingText) return;
    dispatch({ type: 'UPDATE_OBJECT', payload: { id: editingText.id, text: editingText.text } });
    const obj = stateRef.current.objects.find(o => o.id === editingText.id);
    if (obj) void persistUpdate({ ...obj, text: editingText.text });
    releaseLock(editingText.id);
    setEditingText(null);
  }

  function handleTextEditCancel() {
    if (!editingText) return;
    releaseLock(editingText.id);
    setEditingText(null);
  }

  function startTextEdit(id: string) {
    const obj = stateRef.current.objects.find(o => o.id === id);
    if (!obj) return;
    setEditingText({ id, text: obj.text || '' });
    requestLock(id);
  }

  useEffect(() => {
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext('2d')!;
    let rafId: number;
    let lastW = 0;
    let lastH = 0;

    function loop() {
      const container = containerRef.current;
      if (container) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w !== lastW || h !== lastH) {
          cvs.width = w;
          cvs.height = h;
          lastW = w;
          lastH = h;
        }
      }
      renderFrame(ctx, state);
      rafId = requestAnimationFrame(loop);
    }
    loop();
    return () => cancelAnimationFrame(rafId);
  }, [state]);

  const screenToCanvas = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - state.pan.x) / state.zoom,
      y: (sy - state.pan.y) / state.zoom,
    }),
    [state.pan, state.zoom],
  );

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  function handlePointerDown(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { /* already captured or inactive */ }

    if (e.button === 1 || spaceRef.current) {
      panningRef.current = true;
      panOriginRef.current = { x: sx - state.pan.x, y: sy - state.pan.y };
      containerRef.current?.classList.add('cursor-grabbing');
      return;
    }

    const pos = screenToCanvas(sx, sy);

    if (state.activeTool === 'select') {
      const sorted = [...state.objects].sort((a, b) => b.zIndex - a.zIndex);

      for (const obj of sorted) {
        if (lockedObjectIds.current.has(obj.id)) continue;
        const handle = hitTestHandle(pos, obj, state.zoom);
        if (handle) {
          dispatch({ type: 'SNAPSHOT' });
          dispatch({ type: 'SELECT', payload: [obj.id] });
          dragMode.current = 'resize';
          resizeHandle.current = handle;
          resizeIdRef.current = obj.id;
          originRef.current = pos;
          requestLock(obj.id);
          return;
        }
      }

      for (const obj of sorted) {
        if (lockedObjectIds.current.has(obj.id)) continue;
        if (hitTest(pos, obj, state.zoom)) {
          const ids = state.selectedIds.includes(obj.id) ? state.selectedIds : [obj.id];
          dispatch({ type: 'SNAPSHOT' });
          if (!state.selectedIds.includes(obj.id)) {
            dispatch({ type: 'SELECT', payload: ids });
          }
          dragMode.current = 'move';
          moveStartRef.current = pos;
          moveIdsRef.current = ids;
          selectedSnapshot.current = new Map(
            state.objects.filter(o => ids.includes(o.id)).map(o => [o.id, { x: o.x, y: o.y }]),
          );
          for (const id of ids) requestLock(id);
          return;
        }
      }

      dispatch({ type: 'CLEAR_SELECTION' });
      return;
    }

    if (e.detail > 1) return;

    const id = crypto.randomUUID();
    dispatch({ type: 'SNAPSHOT' });
    const newObj: CanvasObject = {
      id,
      type: state.activeTool as CanvasObject['type'],
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      rotation: 0,
      fill: state.fillColor,
      stroke: state.strokeColor,
      strokeWidth: state.strokeWidth,
      opacity: state.opacity / 100,
      text: state.activeTool === 'text' ? 'Text' : state.activeTool === 'stickyNote' ? 'Note' : undefined,
      zIndex: state.objects.length,
    };
    dispatch({ type: 'ADD_OBJECT', payload: newObj, batch: true });
    drawingRef.current = id;
    originRef.current = pos;
    dragMode.current = 'draw';
  }

  function handlePointerMove(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (panningRef.current) {
      dispatch({ type: 'SET_PAN', payload: { x: sx - panOriginRef.current.x, y: sy - panOriginRef.current.y } });
      return;
    }

    const pos = screenToCanvas(sx, sy);
    emitCursor(pos.x, pos.y);

    if (dragMode.current === 'move' && moveStartRef.current) {
      const dx = pos.x - moveStartRef.current.x;
      const dy = pos.y - moveStartRef.current.y;
      const updates = moveIdsRef.current.map(id => ({
        id,
        x: (selectedSnapshot.current.get(id)?.x || 0) + dx,
        y: (selectedSnapshot.current.get(id)?.y || 0) + dy,
      }));
      dispatch({ type: 'UPDATE_OBJECTS', payload: updates, batch: true });
      return;
    }

    if (dragMode.current === 'resize' && originRef.current) {
      const obj = state.objects.find(o => o.id === resizeIdRef.current);
      if (obj && resizeHandle.current) {
        const result = handleResize(obj, resizeHandle.current, originRef.current, pos);
        dispatch({
          type: 'RESIZE_OBJECT',
          payload: { id: obj.id, ...result },
          batch: true,
        });
      }
      return;
    }

    if (dragMode.current !== 'draw' || !drawingRef.current || !originRef.current) return;
    dispatch({
      type: 'UPDATE_OBJECT',
      payload: { id: drawingRef.current, width: pos.x - originRef.current.x, height: pos.y - originRef.current.y },
      batch: true,
    });
  }

  function handlePointerUp(e: React.PointerEvent) {
    const current = stateRef.current;
    if (dragMode.current === 'draw' && drawingRef.current && originRef.current) {
      const obj = current.objects.find(o => o.id === drawingRef.current);
      if (obj) {
        const tiny = Math.abs(obj.width) < 3 && Math.abs(obj.height) < 3;
        const isNote = obj.type === 'text' || obj.type === 'stickyNote';
        if (tiny && !isNote) {
          dispatch({ type: 'DELETE_OBJECTS', payload: [drawingRef.current] });
        } else {
          const normalized = tiny
            ? {
                ...obj,
                width: obj.type === 'stickyNote' ? 160 : 20,
                height: obj.type === 'stickyNote' ? 100 : 20,
              }
            : obj;
          if (tiny) {
            dispatch({
              type: 'UPDATE_OBJECT',
              payload: { id: obj.id, width: normalized.width, height: normalized.height },
            });
          }
          dispatch({ type: 'SELECT', payload: [normalized.id] });
          void persistCreate(normalized, { batch: true });
          if (obj.type === 'text') startTextEdit(normalized.id);
        }
      }
    } else if (dragMode.current === 'move' && moveIdsRef.current.length > 0) {
      const moved = moveIdsRef.current
        .map(id => current.objects.find(o => o.id === id))
        .filter((o): o is CanvasObject => Boolean(o));
      if (moved.length > 0) void persistUpdateMany(moved);
    } else if (dragMode.current === 'resize' && resizeIdRef.current) {
      const obj = current.objects.find(o => o.id === resizeIdRef.current);
      if (obj) void persistUpdate(obj);
    }
    for (const id of [...moveIdsRef.current, resizeIdRef.current].filter(Boolean)) {
      releaseLock(id as string);
    }
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch { /* ignore */ }
    drawingRef.current = null;
    originRef.current = null;
    panningRef.current = false;
    containerRef.current?.classList.remove('cursor-grabbing');
    dragMode.current = 'none';
    resizeHandle.current = null;
    resizeIdRef.current = null;
    moveIdsRef.current = [];
    moveStartRef.current = null;
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (editingText) return;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.code === 'Space') {
        spaceRef.current = true;
        containerRef.current?.classList.add('cursor-grab');
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedIds.length > 0 && !state.selectedIds.some(id => lockedObjectIds.current.has(id))) {
          dispatch({ type: 'DELETE_OBJECTS', payload: state.selectedIds });
          void persistDelete(state.selectedIds);
        }
      }
      if (e.ctrlKey && e.key === 'z') { dispatch({ type: 'UNDO' }); }
      if (e.ctrlKey && e.key === 'Z') { dispatch({ type: 'REDO' }); }
      if (e.key === 'Escape') { dispatch({ type: 'CLEAR_SELECTION' }); }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const tool: Record<string, ToolType> = {
          v: 'select', r: 'rectangle', o: 'ellipse', l: 'line',
          a: 'arrow', t: 'text', n: 'stickyNote', c: 'connector',
        };
        const next = tool[e.key.toLowerCase()];
        if (next) dispatch({ type: 'SET_ACTIVE_TOOL', payload: next });
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') {
        spaceRef.current = false;
        containerRef.current?.classList.remove('cursor-grab');
      }
    }
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [state.selectedIds, editingText, dispatch, persistDelete]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const el = cvs;
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const scale = +(state.zoom * (e.deltaY > 0 ? 0.9 : 1.1)).toFixed(2);
        dispatch({
          type: 'ZOOM_AT',
          payload: { scale, cx: e.clientX - rect.left, cy: e.clientY - rect.top },
        });
      }
    }
    cvs.addEventListener('wheel', onWheel, { passive: false });
    return () => cvs.removeEventListener('wheel', onWheel);
  }, [state.zoom, dispatch]);

  return (
    <div className="relative flex flex-1 overflow-hidden">
      <div ref={containerRef} className="relative flex-1 overflow-hidden bg-surface-950">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        <canvas
          ref={canvasRef}
          data-canvas="surface"
          className="h-full w-full cursor-default"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onContextMenu={handleContextMenu}
          onDoubleClick={handleDoubleClick}
        />
        {state.objects.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
            <p className="text-xs text-surface-500">Pick a tool and draw on the canvas</p>
            <p className="text-[10px] tracking-wide text-surface-600">
              V select · R rect · O ellipse · L line · A arrow · T text · N note · C connector — Ctrl+scroll to zoom, Space to pan
            </p>
          </div>
        )}
        {remoteCursors.map((c) => {
          const color = cursorColor(c.userId);
          return (
            <div
              key={c.userId}
              className="pointer-events-none absolute z-40"
              style={{
                left: c.x * state.zoom + state.pan.x,
                top: c.y * state.zoom + state.pan.y,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" className="drop-shadow">
                <path d="M4 2 L20 11 L11.5 12.5 L8.5 20 Z" fill={color} stroke="rgba(2,6,23,0.9)" strokeWidth="1.5" />
              </svg>
              <span
                className="absolute left-3 top-2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow"
                style={{ backgroundColor: color }}
              >
                {c.displayName}
              </span>
            </div>
          );
        })}
        {[...objectLocks.entries()].map(([objectId, lock]) => {
          const obj = state.objects.find(o => o.id === objectId);
          if (!obj) return null;
          const color = cursorColor(lock.userId);
          return (
            <div
              key={`lock-${objectId}`}
              className="pointer-events-none absolute z-30 flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-white shadow"
              style={{
                left: obj.x * state.zoom + state.pan.x,
                top: obj.y * state.zoom + state.pan.y - 22,
                borderColor: `${color}66`,
                backgroundColor: 'rgba(2,6,23,0.85)',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {lock.displayName}
            </div>
          );
        })}
        {editingText && (() => {
          const obj = state.objects.find(o => o.id === editingText.id);
          if (!obj) return null;
          const left = obj.x * state.zoom + state.pan.x;
          const top = obj.y * state.zoom + state.pan.y;
          const width = Math.max(obj.width * state.zoom, 220);
          return (
            <>
              <div className="absolute inset-0 z-50" onClick={() => handleTextEditCommit()} />
              <div
                className="absolute z-50 rounded-lg border border-primary-500/60 bg-surface-800/95 p-1 shadow-xl backdrop-blur-sm"
                style={{ left, top, width, minHeight: 44 }}
              >
                <textarea
                  autoFocus
                  value={editingText.text}
                  onChange={e => setEditingText({ ...editingText, text: e.target.value })}
                  onBlur={handleTextEditCommit}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      handleTextEditCancel();
                    }
                  }}
                  className="h-full min-h-[36px] w-full resize-none bg-transparent p-1 text-sm text-surface-100 outline-none"
                  onClick={e => e.stopPropagation()}
                />
              </div>
            </>
          );
        })()}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onEditText={(() => {
              if (state.selectedIds.length !== 1) return undefined;
              const sel = state.objects.find(o => o.id === state.selectedIds[0]);
              if (!sel || (sel.type !== 'text' && sel.type !== 'stickyNote')) return undefined;
              return () => startTextEdit(sel.id);
            })()}
          />
        )}
      </div>
      {state.layersOpen && <LayerPanel />}
    </div>
  );
}

function cursorColor(userId: string): string {
  const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'] as const;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length]!;
}
