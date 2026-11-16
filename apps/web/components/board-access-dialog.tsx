"use client";

import { useEffect, useState } from "react";
import { X, LockKeyhole } from "lucide-react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { workspacesApi, type WorkspaceMember } from "@/lib/workspaces";
import { workspaceHomeApi, type BoardAccess } from "@/lib/workspace-home";

export function BoardAccessDialog({
  workspaceId,
  boardId,
  name,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  boardId: string;
  name: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [mode, setMode] = useState<BoardAccess["mode"]>("workspace");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const trap = useFocusTrap(true, () => {
    if (!saving) onClose();
  });
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      workspacesApi.getMembers(workspaceId),
      workspaceHomeApi.getAccess(workspaceId, boardId),
    ])
      .then(([list, access]) => {
        if (cancelled) return;
        setMembers(list.filter((member) => member.status === "ACTIVE"));
        setMode(access.mode);
        setSelected(access.userIds ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled)
          setError("Could not load access settings. Close and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, boardId]);
  async function save() {
    setSaving(true);
    setError("");
    try {
      await workspaceHomeApi.setAccess(workspaceId, boardId, mode, selected);
      onSaved();
      onClose();
    } catch {
      setError(
        "Could not save board access. Your selection has not been confirmed. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <section
        ref={trap}
        role="dialog"
        aria-modal="true"
        aria-labelledby="board-access-title"
        className="max-h-[85vh] w-full max-w-md overflow-auto rounded-2xl border border-surface-700 bg-surface-900 p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <LockKeyhole size={19} className="mb-3 text-surface-400" />
            <h2 id="board-access-title" className="text-lg font-semibold">
              Board access
            </h2>
            <p className="mt-1 truncate text-sm text-surface-500">{name}</p>
          </div>
          <button
            aria-label="Close access settings"
            disabled={saving}
            onClick={onClose}
            className="p-2 text-surface-400"
          >
            <X size={18} />
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status" className="mt-5 text-sm text-surface-400">
            Loading permissions…
          </p>
        ) : (
          <>
            <fieldset disabled={saving} className="mt-6 space-y-3">
              <legend className="mb-3 text-sm font-medium">
                Who can open this board?
              </legend>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-surface-700 p-3 text-sm">
                <input
                  type="radio"
                  name="access"
                  checked={mode === "workspace"}
                  onChange={() => setMode("workspace")}
                />
                Everyone in this workspace
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-surface-700 p-3 text-sm">
                <input
                  type="radio"
                  name="access"
                  checked={mode === "restricted"}
                  onChange={() => setMode("restricted")}
                />
                Selected members
              </label>
              {mode === "restricted" && (
                <div className="space-y-1 rounded-lg bg-surface-950 p-2">
                  {members
                    .filter(
                      (member) => !["OWNER", "ADMIN"].includes(member.role),
                    )
                    .map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-3 rounded-md p-2 text-sm hover:bg-surface-800"
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(member.userId)}
                          onChange={(event) =>
                            setSelected((previous) =>
                              event.target.checked
                                ? [...previous, member.userId]
                                : previous.filter((id) => id !== member.userId),
                            )
                          }
                        />
                        <span className="min-w-0">
                          <span className="block truncate">
                            {member.user?.displayName ?? "Member"}
                          </span>
                          <span className="block truncate text-xs text-surface-500">
                            {member.user?.email}
                          </span>
                        </span>
                        <span className="ml-auto text-xs text-surface-500">
                          {member.role.toLowerCase()}
                        </span>
                      </label>
                    ))}
                  {members.every((member) =>
                    ["OWNER", "ADMIN"].includes(member.role),
                  ) && (
                    <p className="p-2 text-sm text-surface-500">
                      No other members yet.
                    </p>
                  )}
                </div>
              )}
            </fieldset>
            <p className="mt-4 text-xs leading-relaxed text-surface-500">
              Workspace owners and admins always retain access. Selected members
              keep their existing workspace role. Changes apply to tasks, files
              and canvas; connected canvas sessions are removed from the board.
            </p>
            <button
              disabled={saving}
              onClick={save}
              className="mt-6 w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save access"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
