'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { usersApi, type UserProfile, type UserMembership, type AuditLogEntry } from '@/lib/users';
import { ArrowLeft, Mail, Calendar, Shield, BadgeCheck, BadgeX, ExternalLink, Clock, LogIn, Edit3, Trash2, UserPlus, MapPin, Languages } from 'lucide-react';

export default function UserDetailPage() {
  const params = useParams();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [activity, setActivity] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function loadUser() {
    const id = params.id as string;
    setLoading(true);
    setError('');
    Promise.all([
      usersApi.getById(id),
      usersApi.getMemberships(id).catch(() => [] as UserMembership[]),
      usersApi.getActivity(id).catch(() => [] as AuditLogEntry[]),
    ])
      .then(([u, m, a]) => {
        setUser(u);
        setMemberships(m);
        setActivity(a);
      })
      .catch(() => setError('Failed to load this user.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadUser(); }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm font-medium text-red-400">{error}</p>
        <button
          onClick={loadUser}
          className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-500"
        >
          Try again
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 h-4 w-28 animate-pulse rounded bg-surface-800/60" />
        <div className="overflow-hidden rounded-2xl border border-surface-800/50 bg-surface-900/60">
          <div className="flex items-center gap-4 bg-gradient-to-br from-primary-600/10 to-primary-600/5 p-6 sm:p-8">
            <div className="h-16 w-16 animate-pulse rounded-full bg-surface-700/60" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-40 animate-pulse rounded bg-surface-700/60" />
              <div className="h-3 w-56 animate-pulse rounded bg-surface-800/60" />
            </div>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-surface-800/50" />
            ))}
          </div>
        </div>
        <div className="mt-6 h-40 animate-pulse rounded-2xl border border-surface-800/50 bg-surface-900/50" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/users"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-surface-400 transition-colors hover:text-white"
      >
        <ArrowLeft size={14} />
        Back to users
      </Link>

      <div className="overflow-hidden rounded-2xl border border-surface-800/50 bg-gradient-to-br from-surface-900 to-surface-900/60 shadow-xl shadow-black/20">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary-600/10 to-primary-600/5 p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-600/10 blur-3xl" />
          <div className="relative flex flex-col items-center gap-4 sm:flex-row">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="h-16 w-16 shrink-0 rounded-full object-cover shadow-lg shadow-black/20"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-500 to-surface-600 text-xl font-bold text-white shadow-lg shadow-black/20">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="text-center sm:text-left">
              <h1 className="text-xl font-bold tracking-tight">{user.displayName}</h1>
              <p className="mt-0.5 text-sm text-surface-400">{user.email}</p>
              {user.status !== 'ACTIVE' && (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                  <Shield size={11} />
                  {user.status}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="divide-y divide-surface-800 p-6 sm:p-8">
          <div className="grid gap-4 pb-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-surface-500">Email</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-surface-200">
                <Mail size={13} className="text-surface-500" />
                {user.email}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500">Email verified</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm">
                {user.emailVerifiedAt ? (
                  <>
                    <BadgeCheck size={13} className="text-emerald-500" />
                    <span className="text-surface-200">
                      {new Date(user.emailVerifiedAt).toLocaleDateString()}
                    </span>
                  </>
                ) : (
                  <>
                    <BadgeX size={13} className="text-amber-500" />
                    <span className="text-amber-400">Not verified</span>
                  </>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500">Status</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-surface-200">
                <Shield size={13} className="text-surface-500" />
                {user.status}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500">Joined</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-surface-200">
                <Calendar size={13} className="text-surface-500" />
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {user.bio && (
            <div className="py-4">
              <p className="text-xs font-medium text-surface-500">Bio</p>
              <p className="mt-1 text-sm text-surface-300">{user.bio}</p>
            </div>
          )}

          {(user.timezone || user.locale) && (
            <div className="grid gap-4 pt-4 sm:grid-cols-2">
              {user.timezone && (
                <div>
                  <p className="text-xs font-medium text-surface-500">Timezone</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-surface-300">
                    <MapPin size={13} className="text-surface-500" />
                    {user.timezone}
                  </p>
                </div>
              )}
              {user.locale && (
                <div>
                  <p className="text-xs font-medium text-surface-500">Locale</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-surface-300">
                    <Languages size={13} className="text-surface-500" />
                    {user.locale}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Workspace memberships */}
      {memberships.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-surface-800/50 bg-surface-900/60 shadow-xl shadow-black/20">
          <div className="border-b border-surface-800 px-6 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-surface-300">
              <ExternalLink size={14} className="text-surface-500" />
              Workspace memberships ({memberships.length})
            </h2>
          </div>
          <div className="divide-y divide-surface-800">
            {memberships.map((m) => (
              <Link
                key={m.workspaceId}
                href={`/workspaces/${m.workspaceId}`}
                className="flex items-center justify-between px-6 py-3 transition-colors hover:bg-surface-800/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-700 text-xs font-bold text-surface-300">
                    {m.workspaceName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-200">{m.workspaceName}</p>
                    <p className="text-xs text-surface-500">Joined {new Date(m.joinedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className="rounded-md bg-surface-800 px-2 py-0.5 text-xs capitalize text-surface-400">{m.role}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Activity timeline */}
      {activity.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-surface-800/50 bg-surface-900/60 shadow-xl shadow-black/20">
          <div className="border-b border-surface-800 px-6 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-surface-300">
              <Clock size={14} className="text-surface-500" />
              Recent activity
            </h2>
          </div>
          <div className="px-6 py-4">
            <div className="relative space-y-0">
              {activity.slice(0, 10).map((log, i) => (
                <div key={log.id} className="flex gap-4 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full bg-surface-800">
                      {actionIcon(log.action)}
                    </div>
                    {i < Math.min(activity.length, 10) - 1 && <div className="mt-1 w-px flex-1 bg-surface-800" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-sm text-surface-300">
                      {formatAction(log)}
                    </p>
                    <p className="text-xs text-surface-500">{new Date(log.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function actionIcon(action: string) {
  const normalized = action.toLowerCase();
  const icons: Record<string, React.ReactNode> = {
    'login': <LogIn size={10} />,
    'update': <Edit3 size={10} />,
    'delete': <Trash2 size={10} />,
    'create': <UserPlus size={10} />,
  };
  return <span className="text-surface-400">{icons[normalized] || <Clock size={10} />}</span>;
}

function formatAction(log: AuditLogEntry): string {
  // Human-friendly: "board.created" -> "created a board"
  const [entity, verb] = log.action.split('.');
  const action = verb || entity || log.action;
  const entityLabel = (entity || '').replace(/_/g, ' ');
  if (verb) {
    const verbPast = verb.endsWith('e') ? `${verb}d` : verb.endsWith('d') ? verb : `${verb}ed`;
    return `${verbPast} ${entityLabel}${log.entityId ? ` #${log.entityId.slice(0, 8)}` : ''}`;
  }
  return `${action} ${entityLabel}${log.entityId ? ` #${log.entityId.slice(0, 8)}` : ''}`;
}
