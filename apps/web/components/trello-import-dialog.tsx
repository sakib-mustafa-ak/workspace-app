"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { trelloImportApi, type TrelloPreview } from "@/lib/trello-import";
import type { Board } from "@/lib/boards";

export function TrelloImportDialog({
  workspaceId,
  onClose,
  onImported,
}: {
  workspaceId: string;
  onClose: () => void;
  onImported: (board: Board) => void;
}) {
  const [preview, setPreview] = useState<TrelloPreview | null>(null);
  const [exportData, setExportData] = useState<unknown>(null);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const inFlight = useRef(false);
  const close = useCallback(() => {
    if (!inFlight.current) onClose();
  }, [onClose]);
  const trapRef = useFocusTrap(true, close);

  async function selectFile(file?: File) {
    if (inFlight.current) return;
    setPreview(null);
    setExportData(null);
    setError("");
    setUncertain(false);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose a JSON export smaller than 5 MB.");
      return;
    }
    inFlight.current = true;
    setBusy("preview");
    try {
      let data: unknown;
      try {
        data = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
      } catch {
        throw new Error(
          "This file is not valid JSON. Choose a single-board JSON export from Trello.",
        );
      }
      const result = await trelloImportApi.preview(workspaceId, data);
      setExportData(data);
      setPreview(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to preview this export.",
      );
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  async function importBoard() {
    if (!preview || !exportData || inFlight.current || uncertain) return;
    inFlight.current = true;
    setBusy("import");
    setError("");
    try {
      const result = await trelloImportApi.importBoard(workspaceId, exportData);
      onImported(result.board);
    } catch (err) {
      // A lost response may follow a successful commit. Never invite a blind retry.
      setUncertain(true);
      setError(
        `${err instanceof Error ? err.message : "Import could not be confirmed."} Close this dialog and check your boards before trying again.`,
      );
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={close}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trello-import-title"
        aria-describedby="trello-import-description"
        aria-busy={!!busy}
        className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-surface-700 bg-surface-900 p-5 shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="trello-import-title" className="text-lg font-semibold">
              Import from Trello
            </h2>
            <p
              id="trello-import-description"
              className="mt-1 text-sm text-surface-400"
            >
              Copy a board into this workspace using a Trello JSON export.
            </p>
          </div>
          <button
            onClick={close}
            disabled={!!busy}
            aria-label="Close import"
            className="rounded-lg p-2 text-surface-400 hover:bg-surface-800 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-surface-700 p-4">
          <label htmlFor="trello-export" className="block text-sm font-medium">
            Trello board JSON file
          </label>
          <p className="mb-3 mt-1 text-xs text-surface-400">
            One board, up to 5 MB. Requires workspace Editor access or higher.
            No Trello login required.
          </p>
          <input
            id="trello-export"
            type="file"
            accept=".json,application/json"
            disabled={!!busy}
            onChange={(event) => void selectFile(event.target.files?.[0])}
            className="w-full min-w-0 text-sm text-surface-300 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-800 file:px-3 file:py-2 file:text-surface-200 disabled:opacity-50"
          />
          <a
            href="https://support.atlassian.com/trello/docs/exporting-data-from-trello/"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-xs text-primary-400 underline underline-offset-4"
          >
            How to export a Trello board
          </a>
        </div>

        {busy === "preview" && (
          <p
            role="status"
            className="mt-4 flex items-center gap-2 text-sm text-surface-400"
          >
            <Loader2
              size={16}
              className="animate-spin motion-reduce:animate-none"
            />{" "}
            Checking your export...
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-400"
          >
            {error}
          </p>
        )}

        {preview && (
          <section className="mt-5 space-y-4" aria-label="Import preview">
            <div>
              <h3 className="break-words font-medium">{preview.name}</h3>
              <p className="mt-1 text-sm text-surface-400">
                {preview.lists.length} lists · {preview.cardCount} cards ·{" "}
                {preview.checklistItemCount} checklist items
              </p>
            </div>
            <ul className="max-h-40 overflow-y-auto rounded-lg border border-surface-800 divide-y divide-surface-800">
              {preview.lists.map((list, index) => (
                <li
                  key={index}
                  className="flex justify-between gap-4 px-3 py-2 text-sm"
                >
                  <span className="break-words">{list.name}</span>
                  <span className="shrink-0 text-surface-400">
                    {list.cards} cards
                  </span>
                </li>
              ))}
            </ul>
            <div className="text-xs leading-relaxed text-surface-400">
              <p className="mb-2">
                Skipped: {preview.skippedLists} archived lists and{" "}
                {preview.skippedCards} archived cards or cards in archived
                lists.
              </p>
              <ul className="list-disc space-y-1 pl-4">
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <p className="mt-5 text-xs leading-relaxed text-surface-400">
          Creates a new board. Existing boards and your Trello board stay
          unchanged. Importing the same file again creates another copy.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={close}
            disabled={!!busy}
            className="rounded-lg border border-surface-700 px-4 py-2 text-sm disabled:opacity-50"
          >
            {uncertain ? "Close and check boards" : "Cancel"}
          </button>
          <button
            onClick={() => void importBoard()}
            disabled={!preview || !!busy || uncertain}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "import" ? (
              <Loader2
                size={16}
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Upload size={16} />
            )}
            {busy === "import" ? "Importing..." : "Import board"}
          </button>
        </div>
      </div>
    </div>
  );
}
