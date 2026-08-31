'use client';
import { useEffect, useState } from 'react';
import { workspacesApi, type AuditEvent } from '@/lib/workspaces';
import { billingApi } from '@/lib/billing';
import { History, Download } from 'lucide-react';
import { SkeletonBlock } from '@/components/skeleton';
import { useToast } from '@/contexts/toast-context';

export function ActivityTabContent({ workspaceId, plan }: { workspaceId: string; plan: 'FREE' | 'PRO' | 'TEAM' }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const toast = useToast();

  function load() {
    setLoading(true);
    workspacesApi.getActivity(workspaceId, { cursor: cursor ?? undefined })
      .then((res) => {
        setEvents((prev) => [...prev, ...res.data]);
        setCursor(res.nextCursor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  function formatAction(action: string): string {
    return action.replace(/\./g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  if (loading && events.length === 0) return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonBlock key={i} className="h-16" />
      ))}
    </div>
  );

  return (
    <div className="p-6">
      <h2 className="mb-4 text-sm font-semibold">Recent activity</h2>
      {plan === 'TEAM' && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => billingApi.exportAudit(workspaceId, 'csv').catch(() => toast.error('Export failed.'))}
            className="flex items-center gap-1.5 rounded-lg border border-surface-700 px-3 py-1.5 text-xs text-surface-300 hover:border-primary-600 hover:text-primary-300"
          >
            <Download size={13} /> Export CSV
          </button>
          <button
            onClick={() => billingApi.exportAudit(workspaceId, 'json').catch(() => toast.error('Export failed.'))}
            className="flex items-center gap-1.5 rounded-lg border border-surface-700 px-3 py-1.5 text-xs text-surface-300 hover:border-primary-600 hover:text-primary-300"
          >
            <Download size={13} /> Export JSON
          </button>
        </div>
      )}
      <div className="space-y-1">
        {events.length === 0 ? (
          <p className="text-sm text-surface-500">No activity yet</p>
        ) : (
          events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 rounded-lg border border-surface-800 bg-surface-900 px-4 py-3">
              <History size={14} className="mt-0.5 shrink-0 text-surface-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{formatAction(e.action)}</p>
                <p className="text-xs text-surface-500">{e.resourceType} &middot; {new Date(e.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))
        )}
      </div>
      {cursor && (
        <button onClick={load} disabled={loading} className="mt-4 text-xs text-primary-400 hover:text-primary-300">
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
