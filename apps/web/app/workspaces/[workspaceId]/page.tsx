'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  LayoutDashboard, Columns, Users, Mail, Settings, History,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import {
  workspacesApi,
  type Workspace,
  type WorkspaceMember,
  type Invitation,
} from '@/lib/workspaces';
import { boardsApi, type Board } from '@/lib/boards';
import { billingApi, type SubscriptionInfo } from '@/lib/billing';
import { SkeletonBlock, SkeletonCard } from '@/components/skeleton';
import { OverviewTab } from './_components/overview-tab';
import { BoardsTab } from './_components/boards-tab';
import { MembersTab } from './_components/members-tab';
import { InvitationsTab } from './_components/invitations-tab';
import { SettingsTab } from './_components/settings-tab';
import { ActivityTabContent } from './_components/activity-tab';
import { UpgradeNotice } from './_components/upgrade-notice';
import { useToast } from '@/contexts/toast-context';
import { ConfirmModal } from '@/components/confirm-modal';
import { Breadcrumbs } from '@/components/breadcrumbs';

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
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const toast = useToast();

  function loadWorkspace() {
    setLoading(true);
    setError('');
    Promise.all([
      workspacesApi.getById(workspaceId),
      boardsApi.list(workspaceId),
      billingApi.getSubscription(workspaceId).catch(() => null),
      workspacesApi.getMembers(workspaceId).catch(() => []),
    ])
      .then(([ws, boardList, subInfo, memberList]) => {
        setWorkspace(ws);
        setBoards(boardList);
        setSubscription(subInfo);
        setMembers(memberList);
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
  const currentRole = members.find((m) => m.userId === user?.id)?.role ?? null;

  async function handleChangeRole(memberId: string, userId: string, role: string) {
    try {
      const updated = await workspacesApi.changeMemberRole(workspaceId, userId, role);
      setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    } catch {
      toast.error('Failed to change member role. Please try again.');
    }
  }

  async function handleRemoveMember(userId: string) {
    setRemoveTarget(userId);
    setConfirmRemove(true);
  }

  async function confirmRemoveMember() {
    if (!removeTarget) return;
    setConfirmRemove(false);
    try {
      await workspacesApi.removeMember(workspaceId, removeTarget);
      setMembers((prev) => prev.filter((m) => m.userId !== removeTarget));
      setRemoveTarget(null);
    } catch {
      toast.error('Failed to remove member. Please try again.');
      setRemoveTarget(null);
    }
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
      <div className="flex h-full flex-col">
        <header className="border-b border-surface-800">
          <div className="flex items-center gap-3 px-8 py-4">
            <SkeletonBlock className="h-4 w-4 rounded" />
            <div>
              <SkeletonBlock className="h-5 w-40 rounded" />
              <SkeletonBlock className="mt-1 h-3 w-28 rounded" />
            </div>
          </div>
          <nav className="flex gap-1 px-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-8 w-20 rounded-t-lg" />
            ))}
          </nav>
        </header>
        <div className="flex-1 space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-12" />
            ))}
          </div>
        </div>
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

  const tabLabels: Record<Tab, string> = {
    overview: 'Overview',
    boards: 'Boards',
    members: 'Members',
    invitations: 'Invitations',
    settings: 'Settings',
    activity: 'Activity',
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-surface-800">
        <div className="flex items-center gap-3 px-8 py-4">
          <Breadcrumbs
            items={[
              { label: workspace.name, href: `/workspaces/${workspaceId}` },
            ]}
            currentLabel={tabLabels[tab]}
          />
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

      <UpgradeNotice
        plan={subscription?.plan ?? 'FREE'}
        boardCount={workspace.boardCount}
        memberCount={workspace.memberCount}
        onUpgrade={() => setTab('settings')}
      />

      <div className="flex-1 overflow-auto">
        {tab === 'overview' && (
          <OverviewTab workspaceId={workspaceId} onInvite={() => setTab('invitations')} />
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
              } catch {
                toast.error('Failed to revoke invitation. Please try again.');
              }
            }}
          />
        )}
        {tab === 'activity' && <ActivityTabContent workspaceId={workspaceId} plan={subscription?.plan ?? 'FREE'} />}
        {tab === 'settings' && (
          <SettingsTab
            workspace={workspace}
            workspaceId={workspaceId}
            wsOwner={wsOwner}
            members={members}
            currentUserId={user?.id}
            subscription={subscription}
            currentRole={currentRole}
            onUpdate={loadWorkspace}
          />
        )}
      </div>
      <ConfirmModal
        open={confirmRemove}
        title="Remove this member?"
        description="They will lose access to this workspace."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={confirmRemoveMember}
        onCancel={() => { setConfirmRemove(false); setRemoveTarget(null); }}
      />
    </div>
  );
}
