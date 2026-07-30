'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Columns, Settings, Users, Mail, ExternalLink,
  Pencil, Archive, Trash2, UserMinus, Send,
  Ban, Check, History,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import {
  workspacesApi,
  type Workspace,
  type WorkspaceMember,
  type Invitation,
} from '@/lib/workspaces';
import { boardsApi, type Board } from '@/lib/boards';
import { ActivityTabContent } from './_components/activity-tab';

type Tab = 'boards' | 'members' | 'invitations' | 'settings' | 'activity';

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const workspaceId = params.workspaceId as string;

  const [tab, setTab] = useState<Tab>('boards');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  // Settings state
  const [editingWs, setEditingWs] = useState(false);
  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');

  // Invitation form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviteResult, setInviteResult] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [copied, setCopied] = useState(false);

  function loadWorkspace() {
    setLoading(true);
    Promise.all([
      workspacesApi.getById(workspaceId),
      boardsApi.list(workspaceId),
    ])
      .then(([ws, boardList]) => {
        setWorkspace(ws);
        setBoards(boardList);
      })
      .catch(() => router.push('/dashboard'))
      .finally(() => setLoading(false));
  }

  function loadMembers() {
    workspacesApi.getMembers(workspaceId).then(setMembers).catch(() => {});
  }

  function loadInvitations() {
    workspacesApi.listInvitations(workspaceId).then(setInvitations).catch(() => {});
  }

  useEffect(() => { loadWorkspace(); }, [workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'members') loadMembers(); }, [tab, workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'invitations') loadInvitations(); }, [tab, workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const wsOwner = workspace?.ownerId === user?.id;

  async function handleUpdateWs() {
    if (!workspace) return;
    try {
      const updated = await workspacesApi.update(workspaceId, {
        name: wsName.trim() || undefined,
        description: wsDesc.trim() || null,
      });
      setWorkspace(updated);
      setEditingWs(false);
    } catch { /* handled */ }
  }

  async function handleArchiveWs() {
    if (!workspace) return;
    try {
      await workspacesApi.archive(workspaceId);
      setWorkspace({ ...workspace, status: 'ARCHIVED', archivedAt: new Date().toISOString() });
    } catch { /* handled */ }
  }

  async function handleUnarchiveWs() {
    if (!workspace) return;
    try {
      await workspacesApi.unarchive(workspaceId);
      setWorkspace({ ...workspace, status: 'ACTIVE', archivedAt: null });
    } catch { /* handled */ }
  }

  async function handleDeleteWs() {
    if (!workspace || !confirm('Delete this workspace? This cannot be undone.')) return;
    try {
      await workspacesApi.delete(workspaceId);
      router.push('/dashboard');
    } catch { /* handled */ }
  }

  async function handleChangeRole(memberId: string, userId: string, role: string) {
    try {
      const updated = await workspacesApi.changeMemberRole(workspaceId, userId, role);
      setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    } catch { /* handled */ }
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm('Remove this member?')) return;
    try {
      await workspacesApi.removeMember(workspaceId, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch { /* handled */ }
  }

  async function handleCreateInvitation(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      const res = await workspacesApi.createInvitation(workspaceId, { email: inviteEmail.trim(), role: inviteRole });
      setInviteToken(res.token);
      setInviteEmail('');
      setInviteResult('Invitation created!');
      setTimeout(() => setInviteResult(''), 3000);
      loadInvitations();
    } catch { setInviteResult('Failed to send invitation'); }
  }

  async function handleRevokeInvitation(invitationId: string) {
    try {
      await workspacesApi.revokeInvitation(workspaceId, invitationId);
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    } catch { /* handled */ }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-600 border-t-primary-500" />
      </div>
    );
  }

  if (!workspace) return null;

  const tabs: { key: Tab; label: string; icon: typeof Columns }[] = [
    { key: 'boards', label: 'Boards', icon: Columns },
    { key: 'members', label: 'Members', icon: Users },
    { key: 'invitations', label: 'Invitations', icon: Mail },
    { key: 'settings', label: 'Settings', icon: Settings },
    { key: 'activity', label: 'Activity', icon: History },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-surface-800">
        <div className="flex items-center gap-3 px-8 py-4">
          <Link
            href="/dashboard"
            className="text-surface-400 hover:text-white"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold">{workspace.name}</h1>
            <p className="text-xs text-surface-500">
              /{workspace.slug} &middot; {workspace.status}
            </p>
          </div>
        </div>
        <nav className="flex gap-1 px-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-xs font-medium transition-colors ${
                tab === t.key
                  ? 'bg-surface-900 text-white'
                  : 'text-surface-500 hover:text-surface-200'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 overflow-auto">
        {tab === 'boards' && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-surface-400">{boards.length} board(s)</p>
              <Link
                href={`/workspaces/${workspaceId}/boards`}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-500"
              >
                <Columns size={14} />
                View all boards
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {boards.filter((b) => b.status !== 'ARCHIVED').map((board) => (
                <Link
                  key={board.id}
                  href={`/workspaces/${workspaceId}/boards/${board.id}`}
                  className="group rounded-xl border border-surface-800 bg-surface-900 p-5 transition-colors hover:border-surface-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10 text-sm font-bold text-emerald-400">
                      {board.name.charAt(0).toUpperCase()}
                    </div>
                    <ExternalLink size={14} className="text-surface-600 opacity-0 group-hover:opacity-100" />
                  </div>
                  <h3 className="mt-3 font-medium">{board.name}</h3>
                  <p className="mt-1 text-xs text-surface-500">{board.description || 'No description'}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {tab === 'members' && (
          <div className="p-6">
            <h2 className="mb-4 text-sm font-semibold">Members ({members.length})</h2>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-900 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-700 text-xs font-medium">
                      {m.userId.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{m.userId}</p>
                      <p className="text-xs text-surface-500">{m.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {wsOwner && m.userId !== user?.id && (
                      <>
                        <select
                          value={m.role}
                          onChange={(e) => handleChangeRole(m.id, m.userId, e.target.value)}
                          className="rounded border border-surface-700 bg-surface-800 px-2 py-1 text-xs outline-none"
                        >
                          <option value="MEMBER">Member</option>
                          <option value="ADMIN">Admin</option>
                          <option value="OWNER">Owner</option>
                        </select>
                        <button
                          onClick={() => handleRemoveMember(m.userId)}
                          className="rounded p-1 text-surface-500 hover:text-red-400"
                        >
                          <UserMinus size={14} />
                        </button>
                      </>
                    )}
                    {m.userId === user?.id && (
                      <span className="text-xs text-surface-500">You</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'invitations' && (
          <div className="p-6">
            <h2 className="mb-4 text-sm font-semibold">Invitations</h2>
            <form onSubmit={handleCreateInvitation} className="mb-4 flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1 text-surface-400">Email</label>
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
                <label className="block text-xs font-medium mb-1 text-surface-400">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm outline-none"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
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
                    {`${window.location.origin}/workspaces/invitations/accept?token=${inviteToken}`}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/workspaces/invitations/accept?token=${inviteToken}`);
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
                        onClick={() => handleRevokeInvitation(inv.id)}
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
        )}

        {tab === 'activity' && <ActivityTabContent workspaceId={workspaceId} />}

        {tab === 'settings' && (
          <div className="p-6 max-w-lg">
            <h2 className="mb-6 text-sm font-semibold">Workspace settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-surface-400">Name</label>
                <input
                  value={editingWs ? wsName : workspace.name}
                  disabled={!editingWs}
                  onChange={(e) => setWsName(e.target.value)}
                  className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:text-surface-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-surface-400">Description</label>
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
                <button onClick={() => { setEditingWs(true); setWsName(workspace.name); setWsDesc(workspace.description || ''); }} className="flex items-center gap-1.5 rounded-lg border border-surface-700 px-4 py-2 text-xs text-surface-300 hover:text-white">
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
                  <button onClick={handleDeleteWs} className="flex items-center gap-1.5 rounded-lg border border-red-800/50 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10">
                    <Trash2 size={14} /> Delete workspace
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
