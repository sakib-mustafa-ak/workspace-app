'use client';

import { useEffect, useRef } from 'react';
import { createAppSocket } from '@/lib/canvas-socket';
import type { NotificationCreatedSocketPayload } from '@/lib/notifications';
import { useToast } from '@/contexts/toast-context';

const TOAST_DURATION_MS = 5000;

export function NotificationListener() {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = createAppSocket();

    socket.on('notification:created', (payload: NotificationCreatedSocketPayload) => {
      const message = payload.body
        ? `${payload.title}: ${payload.body}`
        : payload.title;
      toastRef.current.info(message, TOAST_DURATION_MS);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return null;
}
