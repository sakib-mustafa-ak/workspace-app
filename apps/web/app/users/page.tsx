'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usersApi, type UserProfile } from '@/lib/users';
import { Search, Trash2, ChevronLeft, ChevronRight, Mail, Calendar } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const limit = 20;

  function loadUsers() {
    setLoading(true);
    usersApi.list({ limit, offset })
      .then((res) => {
        setUsers(res.users);
        setTotal(res.total);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadUsers(); }, [offset]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = search
    ? users.filter((u) =>
        u.displayName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      await usersApi.delete(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setTotal((prev) => prev - 1);
    } catch { /* handled */ }
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
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

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-800/50" />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-surface-800">
            <div className="divide-y divide-surface-800">
              {filtered.map((u) => (
                <Link
                  key={u.id}
                  href={`/users/${u.id}`}
                  className="flex items-center gap-4 bg-surface-900/50 px-5 py-4 transition-colors hover:bg-surface-800/50"
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
                  <button
                    onClick={(e) => { e.preventDefault(); handleDelete(u.id, u.displayName); }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-surface-600 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                    title="Delete user"
                  >
                    <Trash2 size={14} />
                  </button>
                </Link>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-surface-500">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="flex items-center gap-1 rounded-lg border border-surface-700 px-3 py-1.5 text-xs text-surface-400 transition-colors hover:text-white disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                  Previous
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
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
