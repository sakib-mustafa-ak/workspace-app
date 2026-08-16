'use client';

import { useRef, useState } from 'react';
import { Upload, Loader2, Check, AlertCircle } from 'lucide-react';
import { uploadsApi } from '@/lib/uploads';

type Props = {
  workspaceId: string;
  boardId: string;
  onUploaded: () => void;
};

export function BoardUploadButton({ workspaceId, boardId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    setStatus('idle');
    let ok = true;
    try {
      for (const file of list) {
        try {
          await uploadsApi.upload(workspaceId, file, boardId);
        } catch {
          ok = false;
        }
      }
      setStatus(ok ? 'success' : 'error');
      if (ok) onUploaded();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
      setTimeout(() => setStatus('idle'), 2500);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files ?? [])}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Upload files"
        aria-label="Upload files"
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
          status === 'success'
            ? 'bg-emerald-500/10 text-emerald-400'
            : status === 'error'
              ? 'bg-red-500/10 text-red-400'
              : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
        }`}
      >
        {uploading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : status === 'success' ? (
          <Check size={14} />
        ) : status === 'error' ? (
          <AlertCircle size={14} />
        ) : (
          <Upload size={14} />
        )}
        {uploading ? 'Uploading...' : status === 'success' ? 'Uploaded' : status === 'error' ? 'Failed' : 'Upload'}
      </button>
    </>
  );
}
