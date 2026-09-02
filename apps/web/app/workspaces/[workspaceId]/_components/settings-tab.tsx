'use client';

import { useState } from 'react';
import { Pencil, Check, Archive, Trash2 } from 'lucide-react';
import { workspacesApi, type Workspace, type WorkspaceMember } from '@/lib/workspaces';
import { type SubscriptionInfo } from '@/lib/billing';
import { BillingSection } from './billing-section';
import { ConfirmModal } from '@/components/confirm-modal';
import { useToast } from '@/contexts/toast-context';

type Props = {
  workspace: Workspace;
  workspaceId: string;
  wsOwner: boolean;
  members: WorkspaceMember[];
  currentUserId?: string;
  subscription: SubscriptionInfo | null;
  currentRole: string | null;
  onUpdate: () => void;
};

export function SettingsTab({
  workspace,
  workspaceId,
  wsOwner,
  members,
  currentUserId,
  subscription,
  currentRole,
  onUpdate,
}: Props) {
  const [editingWs, setEditingWs] = useState(false);
  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const toast = useToast();
  const canManage = currentRole === 'ADMIN' || currentRole === 'OWNER';

  async function handleUpdateWs() {
    setActionError('');
    try {
      await workspacesApi.update(workspaceId, {
        name: wsName.trim() || undefined,
        description: wsDesc.trim() || null,
      });
      onUpdate();
      setEditingWs(false);
    } catch {
      setActionError('Failed to update workspace.');
      toast.error('Failed to update workspace. Please try again.');
    }
  }

  async function handleArchiveWs() {
    setActionError('');
    try {
      await workspacesApi.archive(workspaceId);
      onUpdate();
    } catch {
      setActionError('Failed to archive workspace.');
      toast.error('Failed to archive workspace. Please try again.');
    }
  }

  async function handleUnarchiveWs() {
    setActionError('');
    try {
      await workspacesApi.unarchive(workspaceId);
      onUpdate();
    } catch {
      setActionError('Failed to unarchive workspace.');
      toast.error('Failed to unarchive workspace. Please try again.');
    }
  }

  async function handleDeleteWs() {
    setActionError('');
    setDeleting(true);
    try {
      await workspacesApi.delete(workspaceId);
      window.location.href = '/dashboard';
    } catch {
      setActionError('Failed to delete workspace.');
      toast.error('Failed to delete workspace. Please try again.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function confirmTransferOwnership() {
    setConfirmTransfer(false);
    setActionError('');
    try {
      await workspacesApi.transferOwnership(workspaceId, transferTarget);
      onUpdate();
    } catch {
      setActionError('Failed to transfer ownership.');
      toast.error('Failed to transfer ownership. Please try again.');
    }
    setTransferTarget('');
  }

  return (
    <div className="max-w-lg p-6">
      <div className="mb-6">
        <BillingSection
          workspaceId={workspaceId}
          subscription={subscription}
          canManage={canManage}
          boardCount={workspace.boardCount}
          memberCount={workspace.memberCount}
          onChanged={onUpdate}
        />
      </div>
      <h2 className="mb-6 text-sm font-semibold">Workspace settings</h2>
      {actionError && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {actionError}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-surface-400">Name</label>
          <input
            value={editingWs ? wsName : workspace.name}
            disabled={!editingWs}
            onChange={(e) => setWsName(e.target.value)}
            className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:text-surface-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-surface-400">Description</label>
          <textarea
            value={editingWs ? wsDesc : (workspace.description || '')}
            disabled={!editingWs}
            onChange={(e) => setWsDesc(e.target.value)}
            className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:text-surface-500"
            rows={3}
          />
        </div>

        {editingWs ? (
          <div className="flex gap-2">
            <button onClick={handleUpdateWs} className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-500">
              <Check size={14} /> Save
            </button>
            <button onClick={() => setEditingWs(false)} className="rounded-lg border border-surface-700 px-4 py-2 text-xs text-surface-400 hover:text-white">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setEditingWs(true); setWsName(workspace.name); setWsDesc(workspace.description || ''); }}
            className="flex items-center gap-1.5 rounded-lg border border-surface-700 px-4 py-2 text-xs text-surface-300 hover:text-white"
          >
            <Pencil size={14} /> Edit
          </button>
        )}

        <hr className="border-surface-800" />

        <div className="space-y-2">
          {workspace.archivedAt ? (
            <button onClick={handleUnarchiveWs} className="flex items-center gap-1.5 rounded-lg border border-surface-700 px-4 py-2 text-xs text-surface-300 hover:text-white">
              <Archive size={14} /> Unarchive workspace
            </button>
          ) : (
            <button onClick={handleArchiveWs} className="flex items-center gap-1.5 rounded-lg border border-surface-700 px-4 py-2 text-xs text-surface-300 hover:text-white">
              <Archive size={14} /> Archive workspace
            </button>
          )}
          {wsOwner && (
            <>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-surface-400">Transfer ownership</label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      setTransferTarget(e.target.value);
                      setConfirmTransfer(true);
                    }
                  }}
                  className="w-full rounded border border-surface-700 bg-surface-800 px-3 py-2 text-xs outline-none focus:border-primary-500/50"
                >
                  <option value="">Select new owner...</option>
                  {members.filter((m) => m.userId !== currentUserId).map((m) => (
                    <option key={m.userId} value={m.userId}>{m.userId.slice(0, 8)}... ({m.role})</option>
                  ))}
                </select>
              </div>
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 rounded-lg border border-red-800/50 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10">
                <Trash2 size={14} /> Delete workspace
              </button>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Delete workspace?"
        description="This will permanently delete this workspace and everything in it. This cannot be undone."
        confirmLabel="Delete workspace"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteWs}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmModal
        open={confirmTransfer}
        title="Transfer ownership?"
        description="This cannot be undone. You will lose owner privileges for this workspace."
        confirmLabel="Transfer"
        variant="danger"
        onConfirm={confirmTransferOwnership}
        onCancel={() => { setConfirmTransfer(false); setTransferTarget(''); }}
      />
    </div>
  );
}
