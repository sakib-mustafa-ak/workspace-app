'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { aiApi } from '@/lib/ai';

type Props = {
  boardId: string;
  onClose: () => void;
};

export function AiSummarizePanel({ boardId, onClose }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    aiApi.summarizeBoard(boardId)
      .then(r => setSummary(r.summary))
      .catch(() => setSummary('Failed to generate summary.'))
      .finally(() => setLoading(false));
  }, [boardId]);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 border-l border-surface-800 bg-surface-900 shadow-xl shadow-black/20 animate-slideIn">
      <div className="flex items-center justify-between border-b border-surface-800 px-6 py-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary-400" />
          <h2 className="text-sm font-semibold">AI Summary</h2>
        </div>
        <button onClick={onClose} className="text-surface-500 hover:text-surface-300">
          <X size={16} />
        </button>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-primary-500" />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-surface-300">{summary}</p>
        )}
      </div>
    </div>
  );
}
