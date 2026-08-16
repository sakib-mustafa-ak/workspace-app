'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  canvasApi,
  type CanvasObject as ServerCanvasObject,
  type CanvasObjectType,
  type CreateCanvasObjectData,
} from '@/lib/canvas';
import { createCanvasSocket } from '@/lib/canvas-socket';
import { useCanvas, type CanvasObject } from './canvas-state';
import { getStoredUser } from '@/lib/auth';

export type RemotePresenceUser = {
  userId: string;
  displayName: string;
};

export type RemoteCursor = RemotePresenceUser & { x: number; y: number };

const LOCAL_TO_SERVER_TYPE: Record<CanvasObject['type'], CanvasObjectType> = {
  rectangle: 'RECTANGLE',
  ellipse: 'ELLIPSE',
  line: 'LINE',
  arrow: 'ARROW',
  path: 'PATH',
  text: 'TEXT',
  stickyNote: 'STICKY_NOTE',
  connector: 'CONNECTOR',
  image: 'IMAGE',
};

const SERVER_TO_LOCAL_TYPE: Record<string, CanvasObject['type']> = {
  RECTANGLE: 'rectangle',
  ELLIPSE: 'ellipse',
  LINE: 'line',
  ARROW: 'arrow',
  PATH: 'path',
  TEXT: 'text',
  STICKY_NOTE: 'stickyNote',
  CONNECTOR: 'connector',
  IMAGE: 'image',
  FRAME: 'rectangle',
};

function toServerObject(obj: CanvasObject): CreateCanvasObjectData {
  return {
    id: obj.id,
    type: LOCAL_TO_SERVER_TYPE[obj.type] ?? 'RECTANGLE',
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    rotation: obj.rotation,
    zIndex: obj.zIndex,
    fill: obj.fill || undefined,
    stroke: obj.stroke || undefined,
    strokeWidth: obj.strokeWidth,
    opacity: obj.opacity,
    data: {
      text: obj.text,
      imageData: obj.imageData,
      sourceId: obj.sourceId,
      targetId: obj.targetId,
      points: obj.points,
    },
  };
}

function toServerUpdate(obj: CanvasObject): Omit<CreateCanvasObjectData, 'id' | 'type'> {
  const { x, y, width, height, rotation, zIndex, fill, stroke, strokeWidth, opacity, data } =
    toServerObject(obj);
  return { x, y, width, height, rotation, zIndex, fill, stroke, strokeWidth, opacity, data };
}

function toLocalObject(server: ServerCanvasObject): CanvasObject {
  const data = (server.data ?? {}) as Record<string, unknown>;
  return {
    id: server.id,
    type: SERVER_TO_LOCAL_TYPE[server.type] ?? 'rectangle',
    x: server.x,
    y: server.y,
    width: server.width,
    height: server.height,
    rotation: server.rotation,
    fill: server.fill ?? '#ffffff',
    stroke: server.stroke ?? '#000000',
    strokeWidth: server.strokeWidth,
    opacity: server.opacity,
    zIndex: server.zIndex,
    text: (data.text as string | undefined) ?? undefined,
    imageData: (data.imageData as string | undefined) ?? undefined,
    sourceId: (data.sourceId as string | undefined) ?? undefined,
    targetId: (data.targetId as string | undefined) ?? undefined,
    points: Array.isArray(data.points) ? data.points as { x: number; y: number }[] : undefined,
  };
}

function toServerShape(obj: CanvasObject): ServerCanvasObject {
  return {
    id: obj.id,
    canvasId: '',
    parentId: null,
    type: LOCAL_TO_SERVER_TYPE[obj.type] ?? 'RECTANGLE',
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    rotation: obj.rotation,
    zIndex: obj.zIndex,
    fill: obj.fill || null,
    stroke: obj.stroke || null,
    strokeWidth: obj.strokeWidth,
    opacity: obj.opacity,
    data: {
      text: obj.text,
      imageData: obj.imageData,
      sourceId: obj.sourceId,
      targetId: obj.targetId,
      points: obj.points,
    },
    createdById: '',
    createdAt: '',
    updatedAt: '',
  };
}

type CanvasSyncApi = {
  persistCreate: (obj: CanvasObject, opts?: { batch?: boolean }) => Promise<void>;
  persistUpdate: (obj: CanvasObject) => Promise<void>;
  persistUpdateMany: (objs: CanvasObject[]) => Promise<void>;
  persistDelete: (objectIds: string[]) => Promise<void>;
  syncSnapshot: (prev: CanvasObject[], next: CanvasObject[]) => Promise<void>;
  /** Broadcast a live object update over the socket without any REST call —
   *  used for real-time pencil strokes mid-drag. */
  broadcastObjectUpdate: (obj: CanvasObject) => void;
  presence: RemotePresenceUser[];
  remoteCursors: RemoteCursor[];
  emitCursor: (x: number, y: number) => void;
  objectLocks: Map<string, RemotePresenceUser>;
  requestLock: (objectId: string) => void;
  releaseLock: (objectId: string) => void;
  loadError: string;
};

const CanvasSyncContext = createContext<CanvasSyncApi | null>(null);

export function useCanvasSync(): CanvasSyncApi {
  const ctx = useContext(CanvasSyncContext);
  if (!ctx) {
    throw new Error('useCanvasSync must be used within CanvasSyncProvider');
  }
  return ctx;
}

type Props = {
  boardId: string;
  children: ReactNode;
};

export function CanvasSyncProvider({ boardId, children }: Props) {
  const { dispatch } = useCanvas();
  const socketRef = useRef<ReturnType<typeof createCanvasSocket> | null>(null);
  const boardIdRef = useRef(boardId);
  const dispatchRef = useRef(dispatch);
  boardIdRef.current = boardId;
  dispatchRef.current = dispatch;

  const [presence, setPresence] = useState<RemotePresenceUser[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [loadError, setLoadError] = useState('');
  const cursorsRef = useRef(new Map<string, RemoteCursor>());
  const lastCursorEmit = useRef(0);
  const lastCursorPos = useRef<{ x: number; y: number } | null>(null);
  const selfIdRef = useRef(getStoredUser()?.id ?? null);

  const [objectLocks, setObjectLocks] = useState<Map<string, RemotePresenceUser>>(new Map());
  const objectLocksRef = useRef(objectLocks);
  objectLocksRef.current = objectLocks;

  const requestLock = useCallback((objectId: string) => {
    socketRef.current?.emit('object:lock', {
      boardId: boardIdRef.current,
      objectId,
    });
  }, []);

  const releaseLock = useCallback((objectId: string) => {
    socketRef.current?.emit('object:unlock', {
      boardId: boardIdRef.current,
      objectId,
    });
    objectLocksRef.current.delete(objectId);
    setObjectLocks(new Map(objectLocksRef.current));
  }, []);

  const emitCursor = useCallback((x: number, y: number) => {
    const now = Date.now();
    const prev = lastCursorPos.current;
    if (
      lastCursorEmit.current &&
      now - lastCursorEmit.current < 40 &&
      prev &&
      Math.abs(prev.x - x) < 2 &&
      Math.abs(prev.y - y) < 2
    ) {
      return;
    }
    lastCursorEmit.current = now;
    lastCursorPos.current = { x, y };
    socketRef.current?.emit('cursor:move', {
      boardId: boardIdRef.current,
      cursor: { x, y },
    });
  }, []);

  useEffect(() => {
    const socket = createCanvasSocket(boardIdRef.current);
    socketRef.current = socket;

    socket.on('presence:update', (users: unknown) => {
      const list = (Array.isArray(users) ? users : []) as Array<{
        userId: string;
        displayName: string;
      }>;
      const others = list.filter((u) => u.userId !== selfIdRef.current);
      setPresence(others.map((u) => ({ userId: u.userId, displayName: u.displayName })));
      const present = new Set(others.map((u) => u.userId));
      for (const [id, cur] of cursorsRef.current) {
        const named = list.find((u) => u.userId === id);
        if (named && named.displayName) {
          cursorsRef.current.set(id, { ...cur, displayName: named.displayName });
        }
        if (!present.has(id)) cursorsRef.current.delete(id);
      }
      setRemoteCursors(Array.from(cursorsRef.current.values()));
      for (const [objectId, lock] of objectLocksRef.current) {
        if (!present.has(lock.userId)) objectLocksRef.current.delete(objectId);
      }
      setObjectLocks(new Map(objectLocksRef.current));
    });

socket.on('cursor:moved', (data: unknown) => {
      const { userId, cursor, displayName } = (data ?? {}) as {
        userId: string;
        cursor?: { x: number; y: number };
        displayName?: string | null;
      };
      if (!userId || userId === selfIdRef.current || !cursor) return;
      const existing = cursorsRef.current.get(userId);
      cursorsRef.current.set(userId, {
        userId,
        displayName: existing?.displayName ?? displayName ?? 'Viewer',
        x: cursor.x,
        y: cursor.y,
      });
      setRemoteCursors(Array.from(cursorsRef.current.values()));
    });

    socket.on('object:created', (server: ServerCanvasObject) => {
      dispatchRef.current({ type: 'ADD_OBJECT', payload: toLocalObject(server) });
    });
    socket.on('object:updated', (server: ServerCanvasObject) => {
      dispatchRef.current({ type: 'UPDATE_OBJECT', payload: toLocalObject(server) });
    });
    socket.on('object:deleted', (objectId: string) => {
      dispatchRef.current({ type: 'DELETE_OBJECTS', payload: [objectId] });
    });

    socket.on('object:locked', (data: unknown) => {
      const { objectId, userId, displayName } = (data ?? {}) as {
        objectId?: string;
        userId?: string;
        displayName?: string;
      };
      if (!objectId || !userId || userId === selfIdRef.current) return;
      objectLocksRef.current.set(objectId, {
        userId,
        displayName: displayName || 'Viewer',
      });
      setObjectLocks(new Map(objectLocksRef.current));
    });

    socket.on('object:unlocked', (data: unknown) => {
      const { objectId } = (data ?? {}) as { objectId?: string };
      if (objectLocksRef.current.delete(objectId ?? '')) {
        setObjectLocks(new Map(objectLocksRef.current));
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [boardId]);

  useEffect(() => {
    let cancelled = false;
    setLoadError('');
    canvasApi
      .getOrCreate(boardIdRef.current)
      .then((canvas) => {
        if (cancelled) return;
        dispatchRef.current({
          type: 'LOAD_OBJECTS',
          payload: canvas.objects.map(toLocalObject),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError('Failed to load this canvas. Please try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const broadcastObjectUpdate = useCallback((obj: CanvasObject) => {
    socketRef.current?.emit('object:updated', {
      boardId: boardIdRef.current,
      object: toServerShape(obj),
    });
  }, []);

  const api: CanvasSyncApi = useMemo(
    () => ({
      persistCreate: async (obj, opts) => {
        // Broadcast first so collaborators see the object immediately;
        // the REST create persists it in the background.
        socketRef.current?.emit('object:created', {
          boardId: boardIdRef.current,
          object: toServerShape(obj),
        });
        try {
          const created = await canvasApi.createObject(
            boardIdRef.current,
            toServerObject(obj),
          );
          const canonical = created ? toLocalObject(created) : obj;
          dispatchRef.current({
            type: 'UPDATE_OBJECT',
            payload: canonical,
            batch: opts?.batch ?? false,
          });
        } catch {
          // Persistence failure is non-fatal for the live session — the
          // object is already on screen and broadcast; a reload will show
          // whether it actually saved.
        }
      },
      persistUpdate: async (obj) => {
        // Broadcast first for real-time updates (e.g. live pencil strokes),
        // then persist. Collaborators must not wait on the REST round-trip.
        socketRef.current?.emit('object:updated', {
          boardId: boardIdRef.current,
          object: toServerShape(obj),
        });
        try {
          await canvasApi.updateObject(
            boardIdRef.current,
            obj.id,
            toServerUpdate(obj),
          );
        } catch {
          // Non-fatal for the live session.
        }
      },
      persistUpdateMany: async (objs) => {
        // Broadcast the batch immediately, then persist in parallel.
        for (const obj of objs) {
          socketRef.current?.emit('object:updated', {
            boardId: boardIdRef.current,
            object: toServerShape(obj),
          });
        }
        try {
          await Promise.all(
            objs.map((o) =>
              canvasApi.updateObject(
                boardIdRef.current,
                o.id,
                toServerUpdate(o),
              ),
            ),
          );
        } catch {
          // Non-fatal for the live session.
        }
      },
      persistDelete: async (objectIds) => {
        await Promise.all(
          objectIds.map((id) => canvasApi.deleteObject(boardIdRef.current, id)),
        );
        for (const objectId of objectIds) {
          socketRef.current?.emit('object:deleted', {
            boardId: boardIdRef.current,
            objectId,
          });
        }
      },
      syncSnapshot: async (prev, next) => {
        const prevMap = new Map(prev.map((o) => [o.id, o]));
        const nextMap = new Map(next.map((o) => [o.id, o]));
        const created = next.filter((o) => !prevMap.has(o.id));
        const deleted = prev.filter((o) => !nextMap.has(o.id)).map((o) => o.id);
        const updated = next.filter((o) => {
          const p = prevMap.get(o.id);
          return !!p && JSON.stringify(p) !== JSON.stringify(o);
        });
        if (created.length > 0) {
          await Promise.all(
            created.map((o) =>
              canvasApi.createObject(boardIdRef.current, toServerObject(o)),
            ),
          );
          for (const o of created) {
            socketRef.current?.emit('object:created', {
              boardId: boardIdRef.current,
              object: toServerShape(o),
            });
          }
        }
        if (updated.length > 0) {
          await Promise.all(
            updated.map((o) =>
              canvasApi.updateObject(boardIdRef.current, o.id, toServerUpdate(o)),
            ),
          );
          for (const o of updated) {
            socketRef.current?.emit('object:updated', {
              boardId: boardIdRef.current,
              object: toServerShape(o),
            });
          }
        }
        if (deleted.length > 0) {
          await Promise.all(
            deleted.map((id) => canvasApi.deleteObject(boardIdRef.current, id)),
          );
          for (const objectId of deleted) {
            socketRef.current?.emit('object:deleted', {
              boardId: boardIdRef.current,
              objectId,
            });
          }
        }
      },
      presence,
      remoteCursors,
      emitCursor,
      objectLocks,
      requestLock,
      releaseLock,
      loadError,
      broadcastObjectUpdate,
    }),
    [presence, remoteCursors, emitCursor, objectLocks, requestLock, releaseLock, loadError, broadcastObjectUpdate],
  );

  return (
    <CanvasSyncContext.Provider value={api}>
      {children}
    </CanvasSyncContext.Provider>
  );
}