'use client';

import { AlertTriangle } from 'lucide-react';
import { useFocusTrap } from '@/hooks/use-focus-trap';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const trapRef = useFocusTrap(open, onCancel);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="w-full max-w-sm rounded-xl border border-surface-800 bg-surface-900 p-6 shadow-xl shadow-black/20 mobile-fullscreen"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          {variant === 'danger' && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
          )}
          <div className="flex-1">
            <h3 id="confirm-modal-title" className="text-sm font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-surface-400">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCancel} disabled={loading} className="rounded-lg border border-surface-700 px-4 py-2 text-xs font-medium text-surface-400 transition-colors hover:text-white disabled:opacity-50">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={loading} className={`rounded-lg px-4 py-2 text-xs font-medium text-white transition-all disabled:opacity-50 ${variant === 'danger' ? 'bg-red-600 hover:bg-red-500' : 'bg-primary-600 hover:bg-primary-500'}`}>
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
