'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ExternalLink, Archive } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { workspacesApi, type Workspace } from '@/lib/workspaces';

export default function DashboardPage() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    workspacesApi
      .list()
      .then(setWorkspaces)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const ws = await workspacesApi.create({ name, slug });
      setWorkspaces((prev) => [ws, ...prev]);
      setShowCreate(false);
      setName('');
      setSlug('');
    } catch {
      // handled
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Hello, {user?.displayName || 'there'}
          </h1>
          <p className="mt-1 text-sm text-surface-400">
            {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
        >
          <Plus size={16} />
          New workspace
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-xl border border-surface-700 bg-surface-800 p-6"
        >
          <h2 className="mb-4 text-sm font-semibold">Create workspace</h2>
          <div className="space-y-3">
            <input
              placeholder="Workspace name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3.5 py-2.5 text-sm outline-none focus:border-primary-500"
              required
            />
            <input
              placeholder="slug (my-team)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3.5 py-2.5 text-sm outline-none focus:border-primary-500"
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-surface-700 px-4 py-2 text-sm text-surface-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl bg-surface-800"
            />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-700 py-16">
          <Archive size={40} className="text-surface-600 mb-3" />
          <p className="text-sm text-surface-400">No workspaces yet</p>
          <p className="text-xs text-surface-500 mt-1">
            Create one to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <Link
              key={ws.id}
              href={`/workspaces/${ws.id}`}
              className="group rounded-xl border border-surface-800 bg-surface-900 p-5 transition-colors hover:border-surface-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600/10 text-sm font-bold text-primary-400">
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <ExternalLink
                  size={14}
                  className="text-surface-600 opacity-0 transition-opacity group-hover:opacity-100"
                />
              </div>
              <h3 className="mt-3 font-medium">{ws.name}</h3>
              <p className="mt-1 text-xs text-surface-500">
                {ws.description || 'No description'}
              </p>
              <p className="mt-2 text-xs text-surface-600">/{ws.slug}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
