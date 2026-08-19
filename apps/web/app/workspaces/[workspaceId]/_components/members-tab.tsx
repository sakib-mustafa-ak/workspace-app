'use client';

import { useState } from 'react';
import { UserMinus } from 'lucide-react';
import type { WorkspaceMember } from '@/lib/workspaces';

type Props = {
  members: WorkspaceMember[];
  wsOwner: boolean;
  currentUserId?: string;
  onChangeRole: (memberId: string, userId: string, role: string) => void;
  onRemoveMember: (userId: string) => void;
};

const ROLE_STYLES: Record<string, string> = {
  ADMIN: 'bg-red-500/10 text-red-400 border-red-500/20',
  EDITOR: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMMENTER: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  VIEWER: 'bg-surface-500/10 text-surface-400 border-surface-500/20',
  OWNER: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${ROLE_STYLES[role] || ROLE_STYLES.VIEWER}`}>
      {role}
    </span>
  );
}

export function MembersTab({
  members,
  wsOwner,
  currentUserId,
  onChangeRole,
  onRemoveMember,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.map((m) => m.userId)));
    }
  }

  async function handleBatchRoleChange(role: string) {
    for (const uid of selectedIds) {
      const member = members.find((m) => m.userId === uid);
      if (member) await onChangeRole(member.id, uid, role);
    }
    setSelectedIds(new Set());
  }

  async function handleBatchRemove() {
    if (!confirm(`Remove ${selectedIds.size} members?`)) return;
    for (const uid of selectedIds) {
      await onRemoveMember(uid);
    }
    setSelectedIds(new Set());
  }

  return (
    <div className="p-6">
      <h2 className="mb-4 text-sm font-semibold">Members ({members.length})</h2>

      {wsOwner && selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary-500/20 bg-primary-500/5 px-4 py-2">
          <span className="text-xs text-surface-400">{selectedIds.size} selected</span>
          <select
            onChange={async (e) => {
              if (e.target.value) await handleBatchRoleChange(e.target.value);
            }}
            className="rounded border border-surface-700 bg-surface-800 px-2 py-1 text-xs outline-none"
          >
            <option value="">Change role...</option>
            <option value="ADMIN">Admin</option>
            <option value="EDITOR">Editor</option>
            <option value="COMMENTER">Commenter</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <button
            onClick={handleBatchRemove}
            className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
          >
            Remove selected
          </button>
        </div>
      )}

      <div className="space-y-2">
        {wsOwner && (
          <label className="flex items-center gap-2 px-1 py-1">
            <input
              type="checkbox"
              checked={selectedIds.size === members.length && members.length > 0}
              onChange={selectAll}
              className="rounded border-surface-600 bg-surface-800"
            />
            <span className="text-xs text-surface-500">Select all</span>
          </label>
        )}
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-900 px-4 py-3">
            <div className="flex items-center gap-3">
              {wsOwner && m.userId !== currentUserId && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(m.userId)}
                  onChange={() => toggleSelect(m.userId)}
                  className="rounded border-surface-600 bg-surface-800"
                />
              )}
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-700 text-xs font-medium">
                {m.user?.displayName?.charAt(0)?.toUpperCase() || m.userId.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-warm-300">{m.user?.displayName || 'Member'}</p>
                  <RoleBadge role={m.role} />
                </div>
                <p className="text-xs text-surface-500">{m.status}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {wsOwner && m.userId !== currentUserId && (
                <>
                  <select
                    value={m.role}
                    onChange={(e) => onChangeRole(m.id, m.userId, e.target.value)}
                    className="rounded border border-surface-700 bg-surface-800 px-2 py-1 text-xs outline-none"
                  >
                    <option value="EDITOR">Editor</option>
                    <option value="ADMIN">Admin</option>
                    <option value="COMMENTER">Commenter</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <button
                    onClick={() => onRemoveMember(m.userId)}
                    title="Remove member"
                    aria-label={`Remove ${m.user?.displayName ?? 'member'}`}
                    className="rounded p-1 text-surface-500 hover:text-red-400"
                  >
                    <UserMinus size={14} />
                  </button>
                </>
              )}
              {m.userId === currentUserId && (
                <span className="text-xs text-surface-500">You</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
