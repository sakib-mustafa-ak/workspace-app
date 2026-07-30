'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { uploadsApi } from '@/lib/uploads';

type Props = {
  workspaceId: string;
  boardId: string;
  onUploaded: () => void;
};

export function BoardUploadButton({ workspaceId, boardId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadsApi.upload(workspaceId, file, boardId);
      onUploaded();
    } catch { /* handled */ }
    finally { setUploading(false); }
  }

  return (
    <>
      <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
      >
        <Upload size={14} />
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
    </>
  );
}
