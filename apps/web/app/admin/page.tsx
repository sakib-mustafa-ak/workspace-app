'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Briefcase,
  ShieldCheck,
  LogOut,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { adminApi, type AdminUser, type AdminWorkspace } from '@/lib/admin';
import { useAuth } from '@/contexts/auth-context';
import { storeUser } from '@/lib/auth';

type Tab = 'users' | 'workspaces';

const TABS = [
  { id: 'users' as Tab, label: 'Users', icon: Users },
  { id: 'workspaces' as Tab, label: 'Workspaces', icon: Briefcase },
];

function ImpersonationBanner({
  onExit,
  impersonatedName,
}: {
  onExit: () => void;
  impersonatedName: string;
}) {
  return (
    <div className="mb-6 flex items-center justify-between rounded-xl border border-amber-800/60 bg-amber-900/30 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-amber-300">
        <AlertTriangle size={16} />
        <span>Impersonating as <strong>{impersonatedName}</strong></span>
      </div>
      <button
        onClick={onExit}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-surface-200 transition-colors hover:bg-surface-800"
      >
        <LogOut size={14} />
        Exit impersonation
      </button>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<
    Record<string, { plan: string; status: string }>
  >({});
  const [impersonating, setImpersonating] = useState(false);
  const [impersonatingName, setImpersonatingName] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const flag = localStorage.getItem('impersonatingUserId');
    if (flag) {
      try {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        setImpersonatingName(stored.displayName || 'Unknown user');
      } catch {
        setImpersonatingName('Unknown user');
      }
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const results = await adminApi.searchUsers(query);
        setUsers(results);
        setWorkspaces([]);
      } else {
        const results = await adminApi.searchWorkspaces(query);
        setWorkspaces(results);
        setUsers([]);
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [query, activeTab]);

  const handleImpersonate = useCallback(
    async (userId: string) => {
      setImpersonating(true);
      try {
        const result = await adminApi.impersonate(userId);
        localStorage.setItem('accessToken', result.token);
        localStorage.setItem('impersonatingUserId', userId);
        storeUser({
          id: result.user.id,
          email: result.user.email,
          displayName: result.user.displayName,
          avatarUrl: null,
          status: result.user.status,
          emailVerifiedAt: null,
          createdAt: result.user.createdAt ?? new Date().toISOString(),
          isAdmin: result.user.isAdmin,
        });
        router.push('/dashboard');
      } catch {
        setImpersonating(false);
      }
    },
    [router],
  );

  const handleExitImpersonation = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('impersonatingUserId');
    router.push('/auth/login');
  }, [router]);

  const handleLoadSubscription = useCallback(async (userId: string) => {
    if (subscriptions[userId]) return;
    try {
      const sub = await adminApi.getSubscription(userId);
      setSubscriptions((prev) => ({ ...prev, [userId]: sub }));
    } catch {
      // handled
    }
  }, [subscriptions]);

  if (!user?.isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-xl border border-red-800/60 bg-red-900/30 p-6 text-center text-red-300">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10" />
          <p className="text-sm">Access denied. Admin privileges required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-display text-2xl font-bold">
        Admin — internal tool
      </h1>

      {impersonating && impersonatingName && (
        <ImpersonationBanner
          onExit={handleExitImpersonation}
          impersonatedName={impersonatingName}
        />
      )}

      <div className="mb-6 flex gap-1 rounded-xl border border-surface-800 bg-surface-900/50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-surface-800 text-white shadow-sm'
                : 'text-surface-400 hover:text-surface-200'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={
              activeTab === 'users'
                ? 'Search users by name or email...'
                : 'Search workspaces by name or slug...'
            }
            className="w-full rounded-lg border border-surface-700/60 bg-surface-800/40 py-2 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-surface-500 hover:border-surface-700 focus:border-primary-500/50"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div className="rounded-xl border border-surface-800 bg-surface-900 p-4">
        {activeTab === 'users' && (
          <UsersTab
            users={users}
            loading={loading}
            onImpersonate={handleImpersonate}
            impersonating={impersonating}
          />
        )}
        {activeTab === 'workspaces' && (
          <WorkspacesTab
            workspaces={workspaces}
            loading={loading}
            subscriptions={subscriptions}
            onLoadSubscription={handleLoadSubscription}
          />
        )}
      </div>
    </div>
  );
}

function UsersTab({
  users,
  loading,
  onImpersonate,
  impersonating,
}: {
  users: AdminUser[];
  loading: boolean;
  onImpersonate: (userId: string) => void;
  impersonating: boolean;
}) {
  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-surface-500">Loading...</p>
    );
  }
  if (users.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-surface-500">
        Search for users above.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div
          key={u.id}
          className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-800/30 px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-surface-200">
                {u.displayName}
              </span>
              {u.isAdmin && (
                <span className="rounded-full bg-primary-900/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-300">
                  Admin
                </span>
              )}
              <span className="rounded-full bg-surface-700/50 px-2 py-0.5 text-[10px] font-medium text-surface-400">
                {u.status}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-surface-500">{u.email}</p>
          </div>
          <button
            onClick={() => onImpersonate(u.id)}
            disabled={u.isAdmin || impersonating}
            title={
              u.isAdmin
                ? 'Cannot impersonate an admin'
                : impersonating
                  ? 'Already impersonating'
                  : 'Log in as this user'
            }
            className="ml-4 flex-shrink-0 rounded-lg border border-surface-700 px-3 py-1.5 text-xs font-medium text-surface-300 transition-colors hover:border-primary-600 hover:text-primary-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Log in as
          </button>
        </div>
      ))}
    </div>
  );
}

function WorkspacesTab({
  workspaces,
  loading,
  subscriptions,
  onLoadSubscription,
}: {
  workspaces: AdminWorkspace[];
  loading: boolean;
  subscriptions: Record<string, { plan: string; status: string }>;
  onLoadSubscription: (userId: string) => void;
}) {
  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-surface-500">Loading...</p>
    );
  }
  if (workspaces.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-surface-500">
        Search for workspaces above.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {workspaces.map((ws) => {
        const sub = subscriptions[ws.id];
        return (
        <div
          key={ws.id}
          className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-800/30 px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-surface-200">
                {ws.name}
              </span>
              <span className="text-[10px] font-mono text-surface-600">
                /{ws.slug}
              </span>
              <span className="rounded-full bg-surface-700/50 px-2 py-0.5 text-[10px] font-medium text-surface-400">
                {ws.status}
              </span>
            </div>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={() => onLoadSubscription(ws.id)}
              className="rounded-lg border border-surface-700 px-3 py-1.5 text-xs font-medium text-surface-300 transition-colors hover:border-primary-600 hover:text-primary-300"
            >
              Subscription
            </button>
            {sub && (
              <span className="ml-2 text-[10px] text-surface-500">
                {sub.plan} ({sub.status})
              </span>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}
