'use client';

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

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
  info: (message: string, durationMs?: number) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const addToast = useCallback((type: ToastType, message: string, undo?: Toast['undo'], durationMs?: number) => {
    const id = String(++toastCounter.current);
    setToasts(prev => [...prev, { id, type, message, undo }]);
    const duration = durationMs ?? (type === 'error' ? 8000 : 4000);
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, duration);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{
      toasts,
      success: (m, u) => addToast('success', m, u),
      error: (m) => addToast('error', m),
      info: (m, d) => addToast('info', m, undefined, d),
      dismiss,
    }}>
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

function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  const icons = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
  };

  const colors = {
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    error: 'border-red-500/20 bg-red-500/10 text-red-400',
    info: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map(t => {
        const Icon = icons[t.type];
        const live = t.type === 'error' ? { role: 'alert' as const } : { 'aria-live': 'polite' as const, 'aria-atomic': true };
        return (
          <div key={t.id} role={live.role} aria-live={live['aria-live']} aria-atomic={live['aria-atomic']} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-md animate-slideUp ${colors[t.type]}`}>
            <Icon size={16} className="shrink-0" />
            <span className="flex-1">{t.message}</span>
            {t.undo && (
              <button onClick={() => { t.undo!.onUndo(); dismiss(t.id); }} className="font-medium underline underline-offset-2">
                {t.undo.label}
              </button>
            )}
            <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100"><X size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}
