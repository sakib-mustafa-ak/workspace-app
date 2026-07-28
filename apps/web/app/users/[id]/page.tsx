'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usersApi, type UserProfile } from '@/lib/users';
import { ArrowLeft, Mail, Calendar, Shield, BadgeCheck, BadgeX, Loader2 } from 'lucide-react';

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.getById(params.id as string)
      .then(setUser)
      .catch(() => router.push('/users'))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/users"
        className="mb-6 flex items-center gap-1.5 text-sm text-surface-400 transition-colors hover:text-white"
      >
        <ArrowLeft size={14} />
        Back to users
      </Link>

      <div className="overflow-hidden rounded-2xl border border-surface-800/50 bg-gradient-to-br from-surface-900 to-surface-900/60 shadow-xl shadow-black/20">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary-600/10 to-primary-600/5 p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-600/10 blur-3xl" />
          <div className="relative flex flex-col items-center gap-4 sm:flex-row">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-500 to-surface-600 text-xl font-bold text-white shadow-lg shadow-black/20">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
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

          <div className="grid gap-4 pt-4 sm:grid-cols-2">
            {user.timezone && (
              <div>
                <p className="text-xs font-medium text-surface-500">Timezone</p>
                <p className="mt-1 text-sm text-surface-300">{user.timezone}</p>
              </div>
            )}
            {user.locale && (
              <div>
                <p className="text-xs font-medium text-surface-500">Locale</p>
                <p className="mt-1 text-sm text-surface-300">{user.locale}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
