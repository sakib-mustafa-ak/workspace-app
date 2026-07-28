'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { canvasApi, type Canvas, type CanvasObject, type CanvasObjectType } from '@/lib/canvas';
import { uploadsApi } from '@/lib/uploads';
import { useCanvasSocket, type PresenceUser } from './use-canvas-socket';

const OBJECT_TOOLS: CanvasObjectType[] = [
  'RECTANGLE', 'ELLIPSE', 'LINE', 'ARROW', 'TEXT', 'STICKY_NOTE',
];

export default function CanvasPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const boardId = params.boardId as string;

  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<CanvasObjectType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveOffset, setMoveOffset] = useState<{ x: number; y: number } | null>(null);

  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, { x: number; y: number }>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastCursorEmit = useRef(0);

  const handleObjectFromSocket = useCallback((obj: CanvasObject) => {
    setCanvas((prev) => {
      if (!prev) return prev;
      const exists = prev.objects.find((o) => o.id === obj.id);
      if (exists) {
        return { ...prev, objects: prev.objects.map((o) => o.id === obj.id ? obj : o) };
      }
      return { ...prev, objects: [...prev.objects, obj] };
    });
  }, []);

  const handleRemoveFromSocket = useCallback((objectId: string) => {
    setCanvas((prev) => {
      if (!prev) return prev;
      return { ...prev, objects: prev.objects.filter((o) => o.id !== objectId) };
    });
  }, []);

  const { emitCursorMove } = useCanvasSocket(boardId, {
    onObjectCreated: handleObjectFromSocket,
    onObjectUpdated: handleObjectFromSocket,
    onObjectDeleted: handleRemoveFromSocket,
    onPresenceUpdate: setOnlineUsers,
    onCursorMoved: (data) => {
      setRemoteCursors((prev) => {
        const next = new Map(prev);
        next.set(data.userId, data.cursor);
        return next;
      });
    },
  });

  useEffect(() => {
    canvasApi.getOrCreate(boardId)
      .then(setCanvas)
      .catch(() => router.push(`/workspaces/${workspaceId}/boards/${boardId}`))
      .finally(() => setLoading(false));
  }, [boardId, workspaceId, router]);

  const handleSurfaceMouseDown = useCallback((e: React.MouseEvent) => {
    if (!selectedTool || !surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDragging(true);
    setDragStart({ x, y });
    setDragCurrent({ x, y });
  }, [selectedTool]);

  const handleSurfaceMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (!isDragging || !dragStart) {
      const now = Date.now();
      if (now - lastCursorEmit.current > 50) {
        lastCursorEmit.current = now;
        emitCursorMove(e.clientX - rect.left, e.clientY - rect.top);
      }
      return;
    }
    setDragCurrent({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [isDragging, dragStart, emitCursorMove]);

  const handleSurfaceMouseUp = useCallback(async () => {
    if (!isDragging || !dragStart || !dragCurrent || !selectedTool) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      return;
    }
    const x = Math.min(dragStart.x, dragCurrent.x);
    const y = Math.min(dragStart.y, dragCurrent.y);
    const w = Math.abs(dragCurrent.x - dragStart.x);
    const h = Math.abs(dragCurrent.y - dragStart.y);
    if (w < 10 || h < 10) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      return;
    }
    try {
      const obj = await canvasApi.createObject(boardId, {
        type: selectedTool,
        x, y, width: w, height: h,
        fill: selectedTool === 'STICKY_NOTE' ? '#fbbf24' : selectedTool === 'RECTANGLE' ? '#3b82f640' : selectedTool === 'ELLIPSE' ? '#8b5cf640' : 'transparent',
        stroke: '#fff',
        strokeWidth: 1,
      });
      setCanvas((prev) => prev ? { ...prev, objects: [...prev.objects, obj] } : prev);
    } catch { /* handled */ }
    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  }, [isDragging, dragStart, dragCurrent, selectedTool, boardId]);

  function handleObjectMouseDown(e: React.MouseEvent, obj: CanvasObject) {
    e.stopPropagation();
    setSelectedId(obj.id);
    setSelectedTool(null);
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMovingId(obj.id);
    setMoveOffset({ x: e.clientX - rect.left - obj.x, y: e.clientY - rect.top - obj.y });
  }

  const handleObjectMouseMove = useCallback(async (e: React.MouseEvent) => {
    if (!surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();

    const now = Date.now();
    if (now - lastCursorEmit.current > 50) {
      lastCursorEmit.current = now;
      emitCursorMove(e.clientX - rect.left, e.clientY - rect.top);
    }

    if (!movingId || !moveOffset) return;
    const newX = e.clientX - rect.left - moveOffset.x;
    const newY = e.clientY - rect.top - moveOffset.y;
    setCanvas((prev) => prev ? {
      ...prev,
      objects: prev.objects.map((o) => o.id === movingId ? { ...o, x: newX, y: newY } : o),
    } : prev);
  }, [movingId, moveOffset, emitCursorMove]);

  const handleObjectMouseUp = useCallback(async () => {
    if (!movingId) return;
    const obj = canvas?.objects.find((o) => o.id === movingId);
    if (obj) {
      try {
        await canvasApi.updateObject(boardId, movingId, { x: obj.x, y: obj.y });
      } catch { /* handled */ }
    }
    setMovingId(null);
    setMoveOffset(null);
  }, [movingId, canvas, boardId]);

  async function handleDeleteObject() {
    if (!selectedId) return;
    try {
      await canvasApi.deleteObject(boardId, selectedId);
      setCanvas((prev) => prev ? { ...prev, objects: prev.objects.filter((o) => o.id !== selectedId) } : prev);
      setSelectedId(null);
    } catch { /* handled */ }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadsApi.upload(workspaceId, file, boardId);
      const obj = await canvasApi.createObject(boardId, {
        type: 'IMAGE',
        x: 100, y: 100,
        width: 300, height: 200,
        data: { url: uploaded.url, originalName: uploaded.originalName },
      });
      setCanvas((prev) => prev ? { ...prev, objects: [...prev.objects, obj] } : prev);
    } catch { /* handled */ }
    e.target.value = '';
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    );
  }

  const previewObj = isDragging && dragStart && dragCurrent ? {
    x: Math.min(dragStart.x, dragCurrent.x),
    y: Math.min(dragStart.y, dragCurrent.y),
    w: Math.abs(dragCurrent.x - dragStart.x),
    h: Math.abs(dragCurrent.y - dragStart.y),
  } : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-surface-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/workspaces/${workspaceId}/boards/${boardId}`}
            className="text-surface-400 hover:text-white"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-sm font-semibold">Canvas</h1>
          <span className="text-xs text-surface-500">
            {canvas?.objects.length || 0} objects
          </span>
          <div className="mx-2 h-5 w-px bg-surface-700" />
          <div className="flex items-center gap-1">
            {onlineUsers.map((user) => (
              <div
                key={user.userId}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-[10px] font-medium text-white"
                title={user.displayName}
              >
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {OBJECT_TOOLS.map((type) => (
            <button
              key={type}
              onClick={() => { setSelectedTool(type); setSelectedId(null); }}
              className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                selectedTool === type
                  ? 'bg-primary-600 text-white'
                  : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
              }`}
            >
              {type === 'RECTANGLE' ? 'Rect' : type === 'ELLIPSE' ? 'Ellipse' : type === 'LINE' ? 'Line' : type === 'ARROW' ? 'Arrow' : type === 'TEXT' ? 'Text' : 'Note'}
            </button>
          ))}
          <div className="mx-1 h-5 w-px bg-surface-700" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-surface-400 hover:bg-surface-800 hover:text-surface-200"
            title="Insert Image"
          >
            <ImageIcon size={12} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <div className="mx-2 h-5 w-px bg-surface-700" />
          {selectedId && (
            <button
              onClick={handleDeleteObject}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
        </div>
      </header>

      <div
        ref={surfaceRef}
        className="relative flex-1 cursor-crosshair overflow-hidden bg-surface-950"
        onMouseDown={handleSurfaceMouseDown}
        onMouseMove={(e) => {
          handleSurfaceMouseMove(e);
          handleObjectMouseMove(e);
        }}
        onMouseUp={() => {
          handleSurfaceMouseUp();
          handleObjectMouseUp();
        }}
        onMouseLeave={() => {
          handleObjectMouseUp();
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {canvas?.objects.map((obj) => (
          <div
            key={obj.id}
            onMouseDown={(e) => handleObjectMouseDown(e, obj)}
            className={`absolute cursor-grab rounded-lg border transition-shadow ${
              selectedId === obj.id ? 'ring-2 ring-primary-500 shadow-lg shadow-primary-500/20' : ''
            }`}
            style={{
              left: obj.x,
              top: obj.y,
              width: obj.width,
              height: obj.height,
              backgroundColor: obj.fill || 'transparent',
              borderColor: obj.stroke || 'rgba(255,255,255,0.2)',
              borderWidth: obj.strokeWidth || 1,
              opacity: obj.opacity,
              transform: `rotate(${obj.rotation}deg)`,
              zIndex: obj.zIndex,
            }}
          >
            {obj.type === 'TEXT' && (
              <div className="flex h-full items-center justify-center px-2 text-xs text-white">
                {(obj.data?.text as string) || 'Text'}
              </div>
            )}
            {obj.type === 'STICKY_NOTE' && (
              <div className="flex h-full items-center justify-center px-2 text-center text-xs font-medium text-amber-950">
                {(obj.data?.text as string) || 'Note'}
              </div>
            )}
            {obj.type === 'IMAGE' && (obj.data?.url as string | undefined) && (
              <img
                src={obj.data?.url as string}
                alt=""
                className="h-full w-full rounded-lg object-cover"
                draggable={false}
              />
            )}
            {obj.type === 'LINE' && (
              <div className="absolute left-0 top-1/2 h-0 -translate-y-1/2 border-t" style={{ width: obj.width, borderColor: obj.stroke || '#fff' }} />
            )}
            {obj.type === 'ARROW' && (
              <div className="absolute left-0 top-1/2 h-0 -translate-y-1/2 border-t" style={{ width: obj.width, borderColor: obj.stroke || '#fff' }}>
                <div className="absolute -right-1.5 -top-1.5 h-0 w-0 border-[5px] border-transparent border-l-white" />
              </div>
            )}
          </div>
        ))}

        {Array.from(remoteCursors.entries()).map(([userId, cursor]) => {
          const user = onlineUsers.find((u) => u.userId === userId);
          return (
            <div
              key={userId}
              className="pointer-events-none absolute z-50"
              style={{ left: cursor.x, top: cursor.y, transform: 'translate(-50%, -50%)' }}
            >
              <div className="h-3 w-3 rounded-full bg-primary-500" />
              <span className="ml-1.5 whitespace-nowrap rounded bg-surface-900/80 px-1.5 py-0.5 text-[10px] text-white">
                {user?.displayName || 'Unknown'}
              </span>
            </div>
          );
        })}

        {previewObj && (
          <div
            className="pointer-events-none absolute rounded-lg border-2 border-dashed border-primary-500/50 bg-primary-500/10"
            style={{
              left: previewObj.x,
              top: previewObj.y,
              width: previewObj.w,
              height: previewObj.h,
            }}
          />
        )}

        {!canvas?.objects.length && !isDragging && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-sm text-surface-500">Select a tool and drag on the canvas to create an object</p>
          </div>
        )}
      </div>
    </div>
  );
}
