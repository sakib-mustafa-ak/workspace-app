'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usersApi, type UserProfile } from '@/lib/users';
import { Search, ChevronLeft, ChevronRight, Mail, Calendar } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 20;

  function loadUsers() {
    setLoading(true);
    setLoadError('');
    usersApi.list({ limit, page, search: search.trim() || undefined })
      .then((res) => {
        setUsers(res.users);
        setTotal(res.total);
      })
      .catch(() => setLoadError('Failed to load users. Please try again.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadUsers(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search: reset to page 1 and re-query server-side.
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-surface-400">{total} total users</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
            className="w-full rounded-lg border border-surface-700 bg-surface-900/50 py-2 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
          />
        </div>
      </div>

      {loadError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5 py-24">
          <p className="text-sm font-medium text-red-400">{loadError}</p>
          <button
            onClick={loadUsers}
            className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-500"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-800/50" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-700/50 bg-surface-900/30 py-24">
          <p className="text-sm font-medium text-surface-400">
            {search ? 'No users match your search' : 'No users yet'}
          </p>
          <p className="mt-1 text-xs text-surface-500">
            {search ? 'Try a different search term' : 'Users will appear here as accounts are created'}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-surface-800">
            <div className="divide-y divide-surface-800">
              {users.map((u) => (
                <Link
                  key={u.id}
                  href={`/users/${u.id}`}
                  className="group flex items-center gap-4 bg-surface-900/50 px-5 py-4 transition-colors hover:bg-surface-800/50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-600 to-surface-700 text-sm font-medium text-surface-200 shadow-sm">
                    {u.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-surface-200">{u.displayName}</span>
                      {u.status !== 'ACTIVE' && (
                        <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                          {u.status}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-surface-500">
                      <span className="flex items-center gap-1">
                        <Mail size={11} />
                        {u.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-surface-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 rounded-lg border border-surface-700 px-3 py-1.5 text-xs text-surface-400 transition-colors hover:text-white disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 rounded-lg border border-surface-700 px-3 py-1.5 text-xs text-surface-400 transition-colors hover:text-white disabled:opacity-30"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
