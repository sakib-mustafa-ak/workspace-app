'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { ToastContainer } from '@/components/toast';

type ToastType = 'success' | 'error' | 'info';

type Toast = {
  id: string;
  type: ToastType;
  message: string;
  undo?: { label: string; onUndo: () => void };
};

type ToastContextType = {
  toasts: Toast[];
  success: (message: string, undo?: Toast['undo']) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, undo?: Toast['undo']) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message, undo }]);
    const duration = type === 'error' ? 8000 : 4000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, success: (m, u) => addToast('success', m, u), error: (m) => addToast('error', m), info: (m) => addToast('info', m), dismiss }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
