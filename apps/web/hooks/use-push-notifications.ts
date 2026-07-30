'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

type PushSubscriptionData = {
  id: string;
  userId: string;
  endpoint: string;
  userAgent: string | null;
  createdAt: string;
};

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64clean = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64clean);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

if (typeof window !== 'undefined' && !VAPID_PUBLIC_KEY) {
  console.warn('NEXT_PUBLIC_VAPID_PUBLIC_KEY not set — push notifications will not work');
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<PushSubscriptionData[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPermission(Notification.permission);
  }, []);

  const loadSubscriptions = useCallback(async () => {
    try {
      const res = await api.get<PushSubscriptionData[]>('/push-subscriptions');
      setSubscriptions(res);
    } catch { /* handled */ }
  }, []);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result === 'granted';
  }, []);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    setLoading(true);
    try {
      const granted = await requestPermission();
      if (!granted) { setLoading(false); return; }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const raw = JSON.parse(JSON.stringify(sub));
      await api.post('/push-subscriptions', {
        endpoint: raw.endpoint,
        p256dh: raw.keys.p256dh,
        auth: raw.keys.auth,
        userAgent: navigator.userAgent,
      });

      await loadSubscriptions();
    } catch (e) {
      console.error('Push subscription failed:', e);
    }
    setLoading(false);
  }, [requestPermission, loadSubscriptions]);

  const unsubscribe = useCallback(async (id?: string) => {
    setLoading(true);
    try {
      if (id) {
        await api.delete(`/push-subscriptions/${id}`);
      } else {
        await api.delete('/push-subscriptions');
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }
      await loadSubscriptions();
    } catch (e) {
      console.error('Unsubscribe failed:', e);
    }
    setLoading(false);
  }, [loadSubscriptions]);

  return {
    permission,
    subscribed: subscriptions.length > 0,
    subscriptions,
    loading,
    requestPermission,
    subscribe,
    unsubscribe,
  };
}
