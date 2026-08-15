'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Columns, Users, ListTodo, Plus, Mail, Loader2,
} from 'lucide-react';
import { workspacesApi, type AuditEvent } from '@/lib/workspaces';
import { boardsApi } from '@/lib/boards';

type Props = {
  workspaceId: string;
  onInvite: () => void;
};

export function OverviewTab({ workspaceId, onInvite }: Props) {
  const [stats, setStats] = useState({ boards: 0, members: 0, tasks: 0 });
  const [recentActivity, setRecentActivity] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      workspacesApi.getActivity(workspaceId).then((r) => setRecentActivity(r.data.slice(0, 5))),
      boardsApi.list(workspaceId).then((boards) => setStats((s) => ({ ...s, boards: boards.length }))),
      workspacesApi.getMembers(workspaceId).then((members) => setStats((s) => ({ ...s, members: members.length }))),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const cards = [
    { label: 'Boards', value: stats.boards, icon: Columns, color: 'text-emerald-400', bg: 'bg-emerald-600/10' },
    { label: 'Members', value: stats.members, icon: Users, color: 'text-blue-400', bg: 'bg-blue-600/10' },
    { label: 'Tasks', value: stats.tasks, icon: ListTodo, color: 'text-amber-400', bg: 'bg-amber-600/10' },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-surface-800 bg-surface-900 p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.bg}`}>
              <c.icon size={18} className={c.color} />
            </div>
            <p className="mt-3 text-2xl font-bold">{c.value}</p>
            <p className="text-xs text-surface-500">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Link
          href={`/workspaces/${workspaceId}/boards`}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-500"
        >
          <Plus size={14} /> New board
        </Link>
        <button onClick={onInvite} className="flex items-center gap-1.5 rounded-lg border border-surface-700 px-4 py-2 text-xs text-surface-300 hover:text-white">
          <Mail size={14} /> Invite members
        </button>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Recent activity</h3>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-surface-500">No activity yet</p>
        ) : (
          <div className="space-y-1">
            {recentActivity.map((e) => (
              <div key={e.id} className="flex items-start gap-3 rounded-lg border border-surface-800 bg-surface-900 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-surface-300">{e.action.replace(/\./g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</p>
                  <p className="text-xs text-surface-500">{new Date(e.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
