'use client';

import { useToast } from '@/contexts/toast-context';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

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

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-md animate-slideUp ${colors[toast.type]}`}
          >
            <Icon size={16} className="shrink-0" />
            <span className="flex-1">{toast.message}</span>
            {toast.undo && (
              <button
                onClick={() => { toast.undo!.onUndo(); dismiss(toast.id); }}
                className="font-medium underline underline-offset-2"
              >
                {toast.undo.label}
              </button>
            )}
            <button onClick={() => dismiss(toast.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
