'use client';

import { useState } from 'react';
import { Sparkles, X, Loader2, Plus } from 'lucide-react';
import { aiApi } from '@/lib/ai';
import { useToast } from '@/contexts/toast-context';
import { useFocusTrap } from '@/hooks/use-focus-trap';

type Props = {
  onClose: () => void;
  onCreateIdea: (title: string) => void;
};

export function AiIdeasDialog({ onClose, onCreateIdea }: Props) {
  const [topic, setTopic] = useState('');
  const [ideas, setIdeas] = useState<{ text: string; priority?: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const trapRef = useFocusTrap(true, onClose);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const result = await aiApi.generateIdeas(topic.trim());
      setIdeas(result.ideas);
    } catch {
      toast.error('Failed to generate ideas. Please try again.');
    }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-ideas-dialog-title"
        className="w-full max-w-md rounded-xl border border-surface-800 bg-surface-900 shadow-xl shadow-black/20 mobile-fullscreen"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary-400" />
            <h2 id="ai-ideas-dialog-title" className="text-sm font-semibold">Generate Ideas</h2>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300"><X size={16} /></button>
        </div>
        <div className="space-y-4 p-6">
          <div className="flex gap-2">
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Enter a topic..."
              className="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm outline-none focus:border-primary-500"
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            />
            <button onClick={handleGenerate} disabled={loading || !topic.trim()} className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-500 disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : 'Generate'}
            </button>
          </div>
          {ideas && (
            <div className="space-y-2">
              {ideas.map((idea, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-950 p-3">
                  <p className="text-sm text-surface-300">{idea.text}</p>
                  <button onClick={() => { onCreateIdea(idea.text); onClose(); }} className="rounded p-1 text-surface-500 hover:text-primary-400">
                    <Plus size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
