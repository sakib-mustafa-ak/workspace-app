'use client';

import { useEffect, useState } from 'react';
import { FileText, Trash2, X } from 'lucide-react';
import { uploadsApi, type UploadedFile } from '@/lib/uploads';

type Props = {
  workspaceId: string;
  boardId: string;
  onClose: () => void;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function BoardFileSidebar({ workspaceId, boardId, onClose }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await uploadsApi.listByBoard(workspaceId, boardId);
      setFiles(data);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [workspaceId, boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(fileId: string) {
    try {
      await uploadsApi.delete(workspaceId, fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch { /* handled */ }
  }

  return (
    <div className="w-72 shrink-0 border-l border-surface-800 bg-surface-900">
      <div className="flex items-center justify-between border-b border-surface-800 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-400">Files</h3>
        <button onClick={onClose} className="text-surface-500 hover:text-surface-300">
          <X size={14} />
        </button>
      </div>
      <div className="space-y-1 p-3">
        {files.map(f => (
          <div key={f.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-surface-800">
            <FileText size={12} className="shrink-0 text-surface-500" />
            <a href={f.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-surface-300 hover:text-white">
              {f.originalName}
            </a>
            <span className="shrink-0 text-surface-500">{formatFileSize(f.size)}</span>
            <button onClick={() => handleDelete(f.id)} className="shrink-0 text-surface-500 hover:text-red-400">
              <Trash2 size={10} />
            </button>
          </div>
        ))}
        {!loading && files.length === 0 && (
          <p className="py-4 text-center text-xs text-surface-500">No files uploaded</p>
        )}
      </div>
    </div>
  );
}
