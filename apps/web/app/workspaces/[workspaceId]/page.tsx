'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, LayoutDashboard, Columns, Users, Mail, Settings, History,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import {
  workspacesApi,
  type Workspace,
  type WorkspaceMember,
  type Invitation,
} from '@/lib/workspaces';
import { boardsApi, type Board } from '@/lib/boards';
import { OverviewTab } from './_components/overview-tab';
import { BoardsTab } from './_components/boards-tab';
import { MembersTab } from './_components/members-tab';
import { InvitationsTab } from './_components/invitations-tab';
import { SettingsTab } from './_components/settings-tab';
import { ActivityTabContent } from './_components/activity-tab';

type Tab = 'overview' | 'boards' | 'members' | 'invitations' | 'settings' | 'activity';

export default function WorkspaceDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const workspaceId = params.workspaceId as string;

  const [tab, setTab] = useState<Tab>('overview');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function loadWorkspace() {
    setLoading(true);
    setError('');
    Promise.all([
      workspacesApi.getById(workspaceId),
      boardsApi.list(workspaceId),
    ])
      .then(([ws, boardList]) => {
        setWorkspace(ws);
        setBoards(boardList);
      })
      .catch(() => setError('Failed to load this workspace. It may have been deleted or you may not have access.'))
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

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm font-medium text-red-400">{error}</p>
        <button
          onClick={() => loadWorkspace()}
          className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-500"
        >
          Try again
        </button>
      </div>
    );
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
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
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
        {tab === 'overview' && (
          <OverviewTab workspaceId={workspaceId} onInvite={() => setTab('members')} />
        )}
        {tab === 'boards' && (
          <BoardsTab workspaceId={workspaceId} boards={boards} />
        )}
        {tab === 'members' && (
          <MembersTab
            members={members}
            wsOwner={wsOwner}
            currentUserId={user?.id}
            onChangeRole={handleChangeRole}
            onRemoveMember={handleRemoveMember}
          />
        )}
        {tab === 'invitations' && (
          <InvitationsTab
            workspaceId={workspaceId}
            invitations={invitations}
            onInviteCreated={loadInvitations}
            onRevoke={async (invitationId) => {
              try {
                await workspacesApi.revokeInvitation(workspaceId, invitationId);
                setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
              } catch { /* handled */ }
            }}
          />
        )}
        {tab === 'activity' && <ActivityTabContent workspaceId={workspaceId} />}
        {tab === 'settings' && (
          <SettingsTab
            workspace={workspace}
            workspaceId={workspaceId}
            wsOwner={wsOwner}
            members={members}
            currentUserId={user?.id}
            onUpdate={loadWorkspace}
          />
        )}
      </div>
    </div>
  );
}
