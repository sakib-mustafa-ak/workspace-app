'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useCanvas, type ToolType, type CanvasObject } from '../_context/canvas-state';
import { useCanvasSync } from '../_context/canvas-sync';
import { getStoredUser } from '@/lib/auth';
import { renderFrame, renderObject } from './canvas-renderer';
import { hitTest, hitTestHandle, handleResize } from './selection-manager';
import { ContextMenu } from './context-menu';
import { LayerPanel } from './layer-panel';

export function CanvasSurface() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useCanvas();
  const { persistCreate, persistUpdate, persistUpdateMany, persistDelete, syncSnapshot, remoteCursors, emitCursor, objectLocks, requestLock, releaseLock, broadcastObjectUpdate } =
    useCanvasSync();

  const drawingRef = useRef<string | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const panningRef = useRef(false);
  const panOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const spaceRef = useRef(false);

  const dragMode = useRef<'none' | 'draw' | 'move' | 'resize' | 'eraser'>('none');
  const resizeHandle = useRef<string | null>(null);
  const resizeIdRef = useRef<string | null>(null);
  const moveIdsRef = useRef<string[]>([]);
  const moveStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectedSnapshot = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragFlushRef = useRef<number | null>(null);
  const dragWorkRef = useRef<(() => void) | null>(null);
  const strokeBufferRef = useRef<{ x: number; y: number }[]>([]);
  const dragStatsRef = useRef({ events: 0, frames: 0 });
  const livePaintRef = useRef<number | null>(null);
  const liveDrawRef = useRef<{ id: string; type: CanvasObject['type']; from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const eraserRef = useRef<Set<string>>(new Set());
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
    const baked = (obj.type === 'text' && obj.text === 'Text') || (obj.type === 'stickyNote' && obj.text === 'Note');
    setEditingText({ id, text: baked ? '' : (obj.text || '') });
    requestLock(id);
  }

  useEffect(() => {
    const cvs = canvasRef.current;
    const container = containerRef.current;
    if (!cvs || !container) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w !== cvs.width || h !== cvs.height) {
        cvs.width = w;
        cvs.height = h;
      }
      renderFrame(ctx, state, () => {
        if (!canvasRef.current) return;
        requestAnimationFrame(() => renderFrame(ctx, stateRef.current));
      });
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
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
      // On a double-click the second pointerdown carries detail > 1. Skip the
      // drag setup so handleDoubleClick can start text editing without also
      // beginning a move drag that shifts the object and grabs a lock.
      if (e.detail > 1) {
        dispatch({ type: 'SELECT', payload: [] });
        return;
      }
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

    if (state.activeTool === 'eraser') {
      dispatch({ type: 'CLEAR_SELECTION' });
      dispatch({ type: 'SNAPSHOT' });
      eraserRef.current = new Set();
      dragMode.current = 'eraser';
      const sorted = [...state.objects].sort((a, b) => b.zIndex - a.zIndex);
      for (const obj of sorted) {
        if (lockedObjectIds.current.has(obj.id)) continue;
        if (hitTest(pos, obj, state.zoom)) {
          eraserRef.current.add(obj.id);
          dispatch({ type: 'DELETE_OBJECTS', payload: [obj.id], batch: true });
          void persistDelete([obj.id]);
          break;
        }
      }
      return;
    }

    if (e.detail > 1) return;

    const id = crypto.randomUUID();
    dispatch({ type: 'SNAPSHOT' });
    if (state.activeTool === 'path') {
      const newPath: CanvasObject = {
        id,
        type: 'path',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        fill: state.fillColor,
        stroke: state.strokeColor,
        strokeWidth: state.strokeWidth,
        opacity: state.opacity / 100,
        points: [{ x: pos.x, y: pos.y }],
        zIndex: state.objects.length,
      };
      dispatch({ type: 'ADD_OBJECT', payload: newPath, batch: true });
      drawingRef.current = id;
      originRef.current = pos;
      dragMode.current = 'draw';
      liveDrawRef.current = { id, type: 'path', from: pos, to: pos };
      startLivePaint();
      return;
    }
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
      zIndex: state.objects.length,
    };
    dispatch({ type: 'ADD_OBJECT', payload: newObj, batch: true });
    drawingRef.current = id;
    originRef.current = pos;
    dragMode.current = 'draw';
    if (state.activeTool === 'rectangle' || state.activeTool === 'ellipse' || state.activeTool === 'line' || state.activeTool === 'arrow') {
      liveDrawRef.current = { id, type: state.activeTool, from: pos, to: pos };
      startLivePaint();
    }
  }

  function flushDragNow() {
    if (dragFlushRef.current !== null) {
      cancelAnimationFrame(dragFlushRef.current);
      dragFlushRef.current = null;
    }
    const work = dragWorkRef.current;
    dragWorkRef.current = null;
    work?.();
  }

  function drawLiveStroke(ctx: CanvasRenderingContext2D) {
    const st = stateRef.current;
    const ld = liveDrawRef.current;
    if (!ld) return;
    ctx.save();
    ctx.translate(st.pan.x, st.pan.y);
    ctx.scale(st.zoom, st.zoom);
    try {
      const obj = st.objects.find(o => o.id === ld.id);
      if (ld.type === 'path') {
        const committed = obj?.points ?? [];
        const tail = strokeBufferRef.current;
        const pts = [...committed, ...tail];
        if (pts.length === 1) {
          ctx.beginPath();
          ctx.arc(pts[0]!.x, pts[0]!.y, Math.max((obj?.strokeWidth ?? st.strokeWidth) / 2, 1), 0, Math.PI * 2);
          ctx.fillStyle = obj?.stroke ?? st.strokeColor;
          ctx.fill();
        } else if (pts.length >= 2) {
          ctx.strokeStyle = obj?.stroke ?? st.strokeColor;
          ctx.lineWidth = obj?.strokeWidth ?? st.strokeWidth;
          ctx.globalAlpha = obj?.opacity ?? 1;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(pts[0]!.x, pts[0]!.y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
          ctx.stroke();
        }
      } else if (obj) {
        ctx.save();
        ctx.translate(obj.x, obj.y);
        ctx.rotate((obj.rotation * Math.PI) / 180);
        ctx.globalAlpha = obj.opacity;
        renderObject(ctx, { ...obj, x: 0, y: 0 });
        ctx.restore();
      }
    } finally {
      ctx.restore();
    }
  }

  function paintOnce() {
    const cvs = canvasRef.current;
    const container = containerRef.current;
    if (!cvs || !container) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w !== cvs.width || h !== cvs.height) {
      cvs.width = w;
      cvs.height = h;
    }
    renderFrame(ctx, stateRef.current);
    drawLiveStroke(ctx);
  }

  function startLivePaint() {
    if (livePaintRef.current !== null) return;
    const tick = () => {
      if (livePaintRef.current === null) return;
      paintOnce();
      livePaintRef.current = requestAnimationFrame(tick);
    };
    livePaintRef.current = requestAnimationFrame(tick);
  }

  function stopLivePaint() {
    if (livePaintRef.current !== null) {
      cancelAnimationFrame(livePaintRef.current);
      livePaintRef.current = null;
    }
    paintOnce();
    liveDrawRef.current = null;
  }

  function scheduleDragFlush(work: () => void) {
    dragWorkRef.current = work;
    if (dragFlushRef.current !== null) return;
    dragFlushRef.current = requestAnimationFrame(() => {
      dragFlushRef.current = null;
      const pending = dragWorkRef.current;
      dragWorkRef.current = null;
      if (pending) {
        dragStatsRef.current.frames++;
        pending();
      }
    });
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
    dragStatsRef.current.events++;

    if (dragMode.current === 'move' && moveStartRef.current) {
      const dx = pos.x - moveStartRef.current.x;
      const dy = pos.y - moveStartRef.current.y;
      const updates = moveIdsRef.current.map(id => ({
        id,
        x: (selectedSnapshot.current.get(id)?.x || 0) + dx,
        y: (selectedSnapshot.current.get(id)?.y || 0) + dy,
      }));
      scheduleDragFlush(() => {
        dispatch({ type: 'UPDATE_OBJECTS', payload: updates, batch: true });
        // Real-time: broadcast the moved objects so collaborators see the
        // drag live, not just on pointer-up.
        for (const u of updates) {
          const o = stateRef.current.objects.find(x => x.id === u.id);
          if (o) broadcastObjectUpdate({ ...o, x: u.x, y: u.y });
        }
      });
      return;
    }

    if (dragMode.current === 'resize' && originRef.current) {
      const obj = stateRef.current.objects.find(o => o.id === resizeIdRef.current);
      if (obj && resizeHandle.current) {
        const result = handleResize(obj, resizeHandle.current, originRef.current, pos);
        scheduleDragFlush(() => {
          dispatch({
            type: 'RESIZE_OBJECT',
            payload: { id: obj.id, ...result },
            batch: true,
          });
          // Real-time: broadcast the resized object mid-drag.
          broadcastObjectUpdate({ ...obj, ...result });
        });
      }
      return;
    }

    if (dragMode.current === 'eraser') {
      const sorted = [...stateRef.current.objects].sort((a, b) => b.zIndex - a.zIndex);
      for (const obj of sorted) {
        if (eraserRef.current.has(obj.id)) continue;
        if (lockedObjectIds.current.has(obj.id)) continue;
        if (hitTest(pos, obj, state.zoom)) {
          eraserRef.current.add(obj.id);
          dispatch({ type: 'DELETE_OBJECTS', payload: [obj.id], batch: true });
          void persistDelete([obj.id]);
        }
      }
      return;
    }

    if (dragMode.current !== 'draw' || !drawingRef.current || !originRef.current) return;
    const drawing = stateRef.current.objects.find(o => o.id === drawingRef.current);
    if (drawing?.type === 'path') {
      const flushed = drawing.points ?? [];
      const buffered = strokeBufferRef.current;
      const last = buffered.length > 0 ? buffered[buffered.length - 1] : flushed[flushed.length - 1];
      if (last && (Math.abs(pos.x - last.x) >= 2 / state.zoom || Math.abs(pos.y - last.y) >= 2 / state.zoom)) {
        buffered.push({ x: pos.x, y: pos.y });
        if (liveDrawRef.current) liveDrawRef.current.to = pos;
        scheduleDragFlush(() => {
          const d = stateRef.current.objects.find(o => o.id === drawingRef.current);
          if (!d || strokeBufferRef.current.length === 0) return;
          const pts = [...(d.points ?? []), ...strokeBufferRef.current];
          strokeBufferRef.current = [];
          const updated = { ...d, points: pts };
          dispatch({
            type: 'UPDATE_OBJECT',
            payload: { id: d.id, points: pts },
            batch: true,
          });
          // Live-broadcast the growing stroke so collaborators see the
          // pencil line in real time, not just on pointer-up.
          broadcastObjectUpdate(updated);
        });
      }
      return;
    }
    const drawId = drawingRef.current;
    const ox = originRef.current.x;
    const oy = originRef.current.y;
    if (liveDrawRef.current) liveDrawRef.current.to = pos;
    scheduleDragFlush(() => {
      const width = pos.x - ox;
      const height = pos.y - oy;
      dispatch({
        type: 'UPDATE_OBJECT',
        payload: { id: drawId, width, height },
        batch: true,
      });
      // Real-time: broadcast the growing shape (rectangle/ellipse/line/
      // arrow) so collaborators see it draw live.
      const d = stateRef.current.objects.find(o => o.id === drawId);
      if (d) broadcastObjectUpdate({ ...d, width, height });
    });
  }

  function handlePointerUp(e: React.PointerEvent) {
    flushDragNow();
    const stats = dragStatsRef.current;
    dragStatsRef.current = { events: 0, frames: 0 };
    if (stats.events > 30) {
      console.debug(`[canvas] drag: ${stats.events} events -> ${stats.frames} frames`);
    }
    const current = stateRef.current;
    if (dragMode.current === 'draw' && drawingRef.current && originRef.current) {
      stopLivePaint();
      const obj = current.objects.find(o => o.id === drawingRef.current);
      if (obj) {
        if (obj.type === 'path') {
          const pts = obj.points ?? [];
          if (pts.length < 2) {
            dispatch({ type: 'DELETE_OBJECTS', payload: [drawingRef.current] });
          } else {
            const xs = pts.map(p => p.x);
            const ys = pts.map(p => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const maxX = Math.max(...xs);
            const maxY = Math.max(...ys);
            const normalized: CanvasObject = {
              ...obj,
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
              points: pts.map(p => ({ x: p.x - minX, y: p.y - minY })),
            };
            dispatch({ type: 'UPDATE_OBJECT', payload: normalized });
            dispatch({ type: 'SELECT', payload: [normalized.id] });
            void persistCreate(normalized, { batch: true });
          }
        } else {
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
    eraserRef.current = new Set();
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
      if (e.ctrlKey && e.key === 'z') {
        const st = stateRef.current;
        const target = st.history.past[st.history.past.length - 1];
        if (!target) return;
        dispatch({ type: 'UNDO' });
        void syncSnapshot(st.objects, target);
      }
      if (e.ctrlKey && e.key === 'Z') {
        const st = stateRef.current;
        const target = st.history.future[0];
        if (!target) return;
        dispatch({ type: 'REDO' });
        void syncSnapshot(st.objects, target);
      }
      if (e.key === 'Escape') { dispatch({ type: 'CLEAR_SELECTION' }); }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const tool: Record<string, ToolType> = {
          v: 'select', r: 'rectangle', o: 'ellipse', l: 'line',
          a: 'arrow', p: 'path', t: 'text', n: 'stickyNote', c: 'connector', e: 'eraser',
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
  }, [state.selectedIds, editingText, dispatch, persistDelete, syncSnapshot]);

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
          onPointerCancel={handlePointerUp}
          onContextMenu={handleContextMenu}
          onDoubleClick={handleDoubleClick}
        />
        {state.objects.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
            <p className="text-xs text-surface-500">Pick a tool and draw on the canvas</p>
            <p className="text-[10px] tracking-wide text-surface-600">
              V select · R rect · O ellipse · L line · A arrow · P pencil · T text · N note · C connector · E eraser — Ctrl+scroll to zoom, Space to pan
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
