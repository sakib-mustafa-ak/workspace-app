'use client';

import { useState } from 'react';
import { Send, Ban } from 'lucide-react';
import { workspacesApi, type Invitation } from '@/lib/workspaces';

type Props = {
  workspaceId: string;
  invitations: Invitation[];
  onInviteCreated: () => void;
  onRevoke: (invitationId: string) => void;
};

export function InvitationsTab({
  workspaceId,
  invitations,
  onInviteCreated,
  onRevoke,
}: Props) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('EDITOR');
  const [inviteResult, setInviteResult] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleCreateInvitation(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      const res = await workspacesApi.createInvitation(workspaceId, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteToken(res.token);
      setInviteEmail('');
      setInviteResult('Invitation created!');
      setTimeout(() => setInviteResult(''), 3000);
      onInviteCreated();
    } catch {
      setInviteResult('Failed to send invitation');
    }
  }

  return (
    <div className="p-6">
      <h2 className="mb-4 text-sm font-semibold">Invitations</h2>
      <form onSubmit={handleCreateInvitation} className="mb-4 flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-surface-400">Email</label>
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm outline-none focus:border-primary-500"
            placeholder="colleague@example.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-surface-400">Role</label>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm outline-none"
          >
            <option value="EDITOR">Editor</option>
            <option value="ADMIN">Admin</option>
            <option value="COMMENTER">Commenter</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </div>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-500"
        >
          <Send size={12} />
          Invite
        </button>
      </form>
      {inviteResult && (
        <p className="mb-2 text-xs text-emerald-400">{inviteResult}</p>
      )}
      {inviteToken && (
        <div className="mb-4 rounded-lg border border-primary-500/20 bg-primary-500/10 px-4 py-3">
          <p className="text-xs font-medium text-primary-300">Invitation link</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-surface-900 px-2 py-1 text-xs text-surface-300">
              {`${window.location.origin}/workspaces/invitations/accept?selector=${inviteToken.split(':')[0]}&verifier=${inviteToken.split(':')[1]}`}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/workspaces/invitations/accept?selector=${inviteToken.split(':')[0]}&verifier=${inviteToken.split(':')[1]}`,
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="shrink-0 rounded bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-500"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {invitations.length === 0 ? (
          <p className="text-sm text-surface-500">No pending invitations</p>
        ) : (
          invitations.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-900 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{inv.email}</p>
                <p className="text-xs text-surface-500">{inv.role} &middot; {inv.status}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-surface-500">
                  Expires {new Date(inv.expiresAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() => onRevoke(inv.id)}
                  className="rounded p-1 text-surface-500 hover:text-red-400"
                >
                  <Ban size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
