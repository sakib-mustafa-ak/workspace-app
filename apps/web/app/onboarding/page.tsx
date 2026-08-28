'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { workspacesApi, type Workspace } from '@/lib/workspaces';
import { boardsApi } from '@/lib/boards';
import { setLastActiveWorkspace, getLastActiveWorkspace } from '@/lib/active-workspace';
import { useToast } from '@/contexts/toast-context';

const STEPS = ['Create workspace', 'Invite teammates', 'Finish up'];

export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [creating, setCreating] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [invitees, setInvitees] = useState<string[]>([]);

  const [makeSampleBoard, setMakeSampleBoard] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!user) return;
    workspacesApi
      .list()
      .then((list) => {
        if (list.length > 0) {
          const lastActive = getLastActiveWorkspace(user.id);
          router.replace(
            lastActive && list.some((w) => w.id === lastActive)
              ? `/workspaces/${lastActive}`
              : '/dashboard',
          );
        }
      })
      .catch(() => {});
  }, [user, router]);

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setCreating(true);
    try {
      const ws = await workspacesApi.create({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
      });
      setWorkspace(ws);
      setStep(1);
    } catch {
      toast.error('Failed to create workspace. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !workspace) return;
    setInvitees((prev) => [...prev, inviteEmail.trim()]);
    setInviteEmail('');
  }

  async function handleSendInvites() {
    if (!workspace || invitees.length === 0) {
      setStep(2);
      return;
    }
    const results = await Promise.allSettled(
      invitees.map((email) =>
        workspacesApi.createInvitation(workspace.id, { email, role: 'EDITOR' }),
      ),
    );
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      toast.error(
        `${failed.length} invitation${failed.length > 1 ? 's' : ''} failed to send.`,
      );
    } else if (invitees.length > 0) {
      toast.success(`Invitations sent to ${invitees.length} teammate${invitees.length > 1 ? 's' : ''}.`);
    }
    setStep(2);
  }

  async function handleFinish() {
    if (!user || !workspace) return;
    setFinishing(true);
    try {
      if (makeSampleBoard) {
        await boardsApi.create(workspace.id, {
          name: 'Sample board',
          description: 'A starter board to explore Workspace OS.',
        });
      }
      setLastActiveWorkspace(user.id, workspace.id);
      router.push(`/workspaces/${workspace.id}`);
    } catch {
      toast.error('Something went wrong. Please try again.');
      setFinishing(false);
    }
  }

  function handleBack() {
    if (step === 1) setStep(0);
    else if (step === 2) setStep(1);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 p-4">
      <div className="w-full max-w-lg">
        <div className="overflow-hidden rounded-2xl border border-surface-800 bg-surface-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-surface-800 px-6 py-4">
            <div className="flex items-center gap-3">
              {STEPS.map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      i < step
                        ? 'bg-primary-600 text-white'
                        : i === step
                          ? 'bg-primary-500/20 text-primary-400'
                          : 'bg-surface-800 text-surface-500'
                    }`}
                  >
                    {i < step ? '\u2713' : i + 1}
                  </span>
                  <span
                    className={`hidden text-xs sm:inline ${
                      i === step ? 'text-surface-200' : 'text-surface-500'
                    }`}
                  >
                    {label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`mx-1 hidden h-px w-6 sm:block ${
                        i < step ? 'bg-primary-600' : 'bg-surface-700'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            {step > 0 && (
              <button
                onClick={handleBack}
                className="rounded-lg p-1.5 text-surface-500 transition-colors hover:bg-surface-800 hover:text-surface-300"
                aria-label="Go back"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="px-6 py-6">
            {step === 0 && (
              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-surface-200">
                    Create your workspace
                  </h2>
                  <p className="mt-1 text-xs text-surface-500">
                    Give your team a home to organize work.
                  </p>
                </div>
                <input
                  placeholder="Workspace name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-surface-700 bg-surface-950 px-3.5 py-2.5 text-sm text-surface-200 outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500/50"
                  required
                />
                <input
                  placeholder="slug (my-team)"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full rounded-lg border border-surface-700 bg-surface-950 px-3.5 py-2.5 text-sm text-surface-200 outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500/50"
                  required
                />
                <button
                  type="submit"
                  disabled={creating || !name.trim() || !slug.trim()}
                  className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-500 hover:shadow-lg hover:shadow-primary-600/25 disabled:opacity-50"
                >
                  {creating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    'Create workspace'
                  )}
                </button>
              </form>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-surface-200">
                    Invite teammates
                  </h2>
                  <p className="mt-1 text-xs text-surface-500">
                    Add people to <span className="text-surface-300">{workspace?.name}</span> so
                    you can start collaborating right away.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="teammate@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleInvite();
                      }
                    }}
                    className="flex-1 rounded-lg border border-surface-700 bg-surface-950 px-3.5 py-2.5 text-sm text-surface-200 outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500/50"
                  />
                  <button
                    type="button"
                    onClick={handleInvite}
                    disabled={!inviteEmail.trim()}
                    className="rounded-lg border border-surface-700 px-4 py-2.5 text-sm text-surface-300 transition-colors hover:border-surface-600 hover:text-white disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                {invitees.length > 0 && (
                  <div className="space-y-2">
                    {invitees.map((email) => (
                      <div
                        key={email}
                        className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-950 px-3 py-2"
                      >
                        <span className="text-sm text-surface-300">{email}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setInvitees((prev) => prev.filter((e) => e !== email))
                          }
                          className="text-surface-500 transition-colors hover:text-surface-300"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSendInvites}
                    className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-500 hover:shadow-lg hover:shadow-primary-600/25"
                  >
                    {invitees.length > 0 ? `Invite ${invitees.length} teammate${invitees.length > 1 ? 's' : ''}` : 'Skip'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-lg border border-surface-700 px-4 py-2.5 text-sm text-surface-400 transition-colors hover:text-white"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-sm font-semibold text-surface-200">
                    Finish up
                  </h2>
                  <p className="mt-1 text-xs text-surface-500">
                    Almost there! Optionally create a starter board to explore
                    your new workspace.
                  </p>
                </div>
                <label className="flex items-start gap-3 rounded-lg border border-surface-800 bg-surface-950 p-4 transition-colors hover:border-surface-700">
                  <input
                    type="checkbox"
                    checked={makeSampleBoard}
                    onChange={(e) => setMakeSampleBoard(e.target.checked)}
                    className="mt-0.5 accent-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-surface-200">
                      Create a sample board
                    </p>
                    <p className="mt-0.5 text-xs text-surface-500">
                      A starter board to explore Workspace OS.
                    </p>
                  </div>
                </label>
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={finishing}
                  className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-500 hover:shadow-lg hover:shadow-primary-600/25 disabled:opacity-50"
                >
                  {finishing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Finishing...
                    </span>
                  ) : (
                    'Finish'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
