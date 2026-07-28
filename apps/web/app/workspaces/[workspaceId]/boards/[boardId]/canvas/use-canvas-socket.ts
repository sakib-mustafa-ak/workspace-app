'use client';

import { useEffect, useRef } from 'react';
import { createCanvasSocket } from '@/lib/canvas-socket';
import type { CanvasObject } from '@/lib/canvas';

export type PresenceUser = {
  userId: string;
  displayName: string;
  cursor?: { x: number; y: number };
  joinedAt: string;
};

type CanvasSocketCallbacks = {
  onObjectCreated: (obj: CanvasObject) => void;
  onObjectUpdated: (obj: CanvasObject) => void;
  onObjectDeleted: (objectId: string) => void;
  onPresenceUpdate: (users: PresenceUser[]) => void;
  onCursorMoved: (data: { userId: string; cursor: { x: number; y: number } }) => void;
};

export function useCanvasSocket(
  boardId: string | undefined,
  callbacks: CanvasSocketCallbacks,
) {
  const socketRef = useRef<ReturnType<typeof createCanvasSocket> | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!boardId) return;

    const socket = createCanvasSocket(boardId);
    socketRef.current = socket;

    socket.on('object:created', (obj: CanvasObject) => {
      callbacksRef.current.onObjectCreated(obj);
    });

    socket.on('object:updated', (obj: CanvasObject) => {
      callbacksRef.current.onObjectUpdated(obj);
    });

    socket.on('object:deleted', (objectId: string) => {
      callbacksRef.current.onObjectDeleted(objectId);
    });

    socket.on('presence:update', (users: PresenceUser[]) => {
      callbacksRef.current.onPresenceUpdate(users);
    });

    socket.on('cursor:moved', (data: { userId: string; cursor: { x: number; y: number } }) => {
      callbacksRef.current.onCursorMoved(data);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [boardId]);

  const emitCursorMove = (x: number, y: number) => {
    socketRef.current?.emit('cursor:move', { boardId, cursor: { x, y } });
  };

  return { emitCursorMove };
}
