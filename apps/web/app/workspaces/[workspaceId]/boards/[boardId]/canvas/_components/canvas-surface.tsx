'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useCanvas, type CanvasObject } from '../_context/canvas-state';
import { renderFrame } from './canvas-renderer';
import { hitTest, hitTestHandle, handleResize } from './selection-manager';
import { ContextMenu } from './context-menu';

export function CanvasSurface() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useCanvas();

  const drawingRef = useRef<string | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const panningRef = useRef(false);
  const panOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const spaceRef = useRef(false);

  const dragMode = useRef<'none' | 'draw' | 'move' | 'resize'>('none');
  const resizeHandle = useRef<string | null>(null);
  const moveStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectedSnapshot = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingText, setEditingText] = useState<{ id: string; text: string } | null>(null);

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
      if ((obj.type === 'text' || obj.type === 'stickyNote') && hitTest(pos, obj)) {
        setEditingText({ id: obj.id, text: obj.text || '' });
        return;
      }
    }
  }

  function handleTextEditCommit() {
    if (!editingText) return;
    dispatch({ type: 'UPDATE_OBJECT', payload: { id: editingText.id, text: editingText.text } });
    setEditingText(null);
  }

  useEffect(() => {
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext('2d')!;
    let rafId: number;

    function loop() {
      const container = containerRef.current;
      if (container) {
        cvs.width = container.clientWidth;
        cvs.height = container.clientHeight;
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

    if (e.button === 1 || spaceRef.current) {
      panningRef.current = true;
      panOriginRef.current = { x: sx - state.pan.x, y: sy - state.pan.y };
      return;
    }

    const pos = screenToCanvas(sx, sy);

    if (state.activeTool === 'select') {
      const sorted = [...state.objects].sort((a, b) => b.zIndex - a.zIndex);

      for (const obj of sorted) {
        const handle = hitTestHandle(pos, obj);
        if (handle) {
          dispatch({ type: 'SELECT', payload: [obj.id] });
          dragMode.current = 'resize';
          resizeHandle.current = handle;
          originRef.current = pos;
          return;
        }
      }

      for (const obj of sorted) {
        if (hitTest(pos, obj)) {
          if (!state.selectedIds.includes(obj.id)) {
            dispatch({ type: 'SELECT', payload: [obj.id] });
          }
          dragMode.current = 'move';
          moveStartRef.current = pos;
          selectedSnapshot.current = new Map(
            state.objects.filter(o => state.selectedIds.includes(o.id)).map(o => [o.id, { x: o.x, y: o.y }]),
          );
          return;
        }
      }

      dispatch({ type: 'CLEAR_SELECTION' });
      return;
    }

    const id = crypto.randomUUID();
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
    dispatch({ type: 'ADD_OBJECT', payload: newObj });
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

    if (dragMode.current === 'move' && moveStartRef.current) {
      const dx = pos.x - moveStartRef.current.x;
      const dy = pos.y - moveStartRef.current.y;
      const updates = state.selectedIds.map(id => ({
        id,
        x: (selectedSnapshot.current.get(id)?.x || 0) + dx,
        y: (selectedSnapshot.current.get(id)?.y || 0) + dy,
      }));
      dispatch({ type: 'UPDATE_OBJECTS', payload: updates });
      return;
    }

    if (dragMode.current === 'resize' && originRef.current) {
      const obj = state.objects.find(o => o.id === state.selectedIds[0]);
      if (obj && resizeHandle.current) {
        const result = handleResize(obj, resizeHandle.current, originRef.current, pos);
        dispatch({
          type: 'RESIZE_OBJECT',
          payload: { id: obj.id, ...result },
        });
      }
      return;
    }

    if (dragMode.current !== 'draw' || !drawingRef.current || !originRef.current) return;
    dispatch({
      type: 'UPDATE_OBJECT',
      payload: { id: drawingRef.current, width: pos.x - originRef.current.x, height: pos.y - originRef.current.y },
    });
  }

  function handlePointerUp() {
    if (dragMode.current === 'draw' && drawingRef.current && originRef.current) {
      const obj = state.objects.find(o => o.id === drawingRef.current);
      if (obj && Math.abs(obj.width) < 3 && Math.abs(obj.height) < 3) {
        dispatch({ type: 'DELETE_OBJECTS', payload: [drawingRef.current] });
      }
    }
    drawingRef.current = null;
    originRef.current = null;
    panningRef.current = false;
    dragMode.current = 'none';
    resizeHandle.current = null;
    moveStartRef.current = null;
  }

  function handleWheel(e: React.WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      dispatch({ type: 'SET_ZOOM', payload: +(state.zoom * delta).toFixed(2) });
    }
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.code === 'Space') { spaceRef.current = true; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedIds.length > 0) {
          dispatch({ type: 'DELETE_OBJECTS', payload: state.selectedIds });
        }
      }
      if (e.ctrlKey && e.key === 'z') { dispatch({ type: 'UNDO' }); }
      if (e.ctrlKey && e.key === 'Z') { dispatch({ type: 'REDO' }); }
      if (e.key === 'Escape') { dispatch({ type: 'CLEAR_SELECTION' }); }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') { spaceRef.current = false; }
    }
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [state.selectedIds, dispatch]);

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden bg-surface-950">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
      />
      {editingText && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" onClick={() => handleTextEditCommit()}>
          <textarea
            autoFocus
            value={editingText.text}
            onChange={e => setEditingText({ ...editingText, text: e.target.value })}
            onBlur={handleTextEditCommit}
            onKeyDown={e => { if (e.key === 'Escape') handleTextEditCommit(); }}
            className="min-w-[200px] rounded-lg border border-primary-500 bg-surface-800 p-2 text-sm text-surface-200 outline-none"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
}
