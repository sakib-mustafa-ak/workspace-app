"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import {
  WorkbenchActivityBar,
  WorkbenchStatusBar,
  WorkbenchTitleBar,
} from "@/components/workbench-chrome";
import { WorkbenchExplorer } from "@/components/workbench-explorer";
import { WorkbenchLayoutControls } from "@/components/workbench-layout-controls";
import { WorkbenchResizeHandle } from "@/components/workbench-resize-handle";
import { WorkbenchTabs } from "@/components/workbench-tabs";
import {
  WorkbenchNotifications,
  WorkbenchQuickAccess,
} from "@/components/workbench-panels";
import { ErrorBoundary } from "@/components/error-boundary";
import { useWorkbenchLayout } from "@/hooks/use-workbench-layout";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import type { WorkbenchLayout } from "@/lib/workbench-layout";

export function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <VerifiedAccess>
        <WorkbenchShell>{children}</WorkbenchShell>
      </VerifiedAccess>
    </AuthProvider>
  );
}

function WorkbenchShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { layout, setLayout, reset } = useWorkbenchLayout();
  const [desktop, setDesktop] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1024);
  const [mobileExplorer, setMobileExplorer] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const section =
    pathname === "/onboarding"
      ? "Set up workspace"
      : pathname === "/dashboard"
        ? "Dashboard"
        : pathname === "/dashboard/plugins"
          ? "Plugins"
          : pathname.endsWith("/canvas")
            ? "Canvas"
            : /^\/workspaces\/[^/]+\/boards\/[^/]+\/?$/.test(pathname)
              ? "Board"
              : pathname.endsWith("/manage")
                ? "Workspace settings"
                : pathname.startsWith("/workspaces/")
                  ? "Workspace"
                  : pathname === "/notifications"
                    ? "Notifications"
                    : pathname.startsWith("/users")
                      ? "People"
                      : pathname === "/settings"
                        ? "Settings"
                        : "Workspace OS";
  const label = labels[pathname] ?? section;
  useEffect(() => {
    const media = matchMedia("(min-width: 1024px)");
    const update = () => {
      setDesktop(media.matches);
      setViewportWidth(window.innerWidth);
    };
    update();
    media.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  useEffect(() => {
    setMobileExplorer(false);
  }, [pathname]);
  const onLabel = useCallback((href: string, title: string) => {
    setLabels((previous) =>
      previous[href] === title ? previous : { ...previous, [href]: title },
    );
  }, []);
  useEffect(() => {
    function titleChanged(event: Event) {
      const detail = (event as CustomEvent<{ href: string; title: string }>)
        .detail;
      if (detail?.href === pathname && typeof detail.title === "string")
        onLabel(detail.href, detail.title);
    }
    window.addEventListener("workbench:title", titleChanged);
    return () => window.removeEventListener("workbench:title", titleChanged);
  }, [pathname, onLabel]);
  const change = (patch: Partial<WorkbenchLayout>) => {
    setLayout((previous) => ({ ...previous, ...patch }));
    if (!desktop && patch.explorer === true) setMobileExplorer(true);
  };
  const toggleExplorer = () =>
    desktop
      ? change({ explorer: !layout.explorer })
      : setMobileExplorer(!mobileExplorer);
  useEffect(() => {
    function resizeShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "b" && event.altKey) {
        event.preventDefault();
        setLayout((previous) => ({
          ...previous,
          secondary: !previous.secondary,
        }));
      } else if (key === "b") {
        event.preventDefault();
        if (desktop)
          setLayout((previous) => ({
            ...previous,
            explorer: !previous.explorer,
          }));
        else setMobileExplorer((value) => !value);
      } else if (key === "j" && !event.altKey) {
        event.preventDefault();
        setLayout((previous) => ({ ...previous, panel: !previous.panel }));
      }
    }
    document.addEventListener("keydown", resizeShortcut);
    return () => document.removeEventListener("keydown", resizeShortcut);
  }, [desktop, setLayout]);
  const shortcuts = [
    {
      keys: ["g", "d"],
      description: "Go to Dashboard",
      action: () => router.push("/dashboard"),
    },
    {
      keys: ["g", "n"],
      description: "Go to Notifications",
      action: () => router.push("/notifications"),
    },
    {
      keys: ["g", "s"],
      description: "Go to Settings",
      action: () => router.push("/settings"),
    },
    {
      keys: ["g", "u"],
      description: "Go to People",
      action: () => router.push("/users"),
    },
  ];
  const { showCheatSheet, setShowCheatSheet } = useKeyboardShortcuts(shortcuts);
  const closeShortcuts = useCallback(() => setShowCheatSheet(false), [setShowCheatSheet]);
  const closeMobileExplorer = useCallback(() => setMobileExplorer(false), []);
  const shortcutsTrapRef = useFocusTrap(showCheatSheet, closeShortcuts);
  const explorerTrapRef = useFocusTrap(mobileExplorer && !desktop, closeMobileExplorer);
  // Leave a usable editor even when both sidebars are enlarged.
  const availableWidth =
    viewportWidth - (pathname === "/dashboard" ? 176 : 48) - 320;
  const explorerMax = Math.max(
    180,
    Math.min(400, availableWidth - (layout.secondary ? 220 : 0)),
  );
  const explorerWidth = Math.min(layout.explorerWidth, explorerMax);
  const secondaryMax = Math.max(
    220,
    Math.min(420, availableWidth - (layout.explorer ? explorerWidth : 0)),
  );
  const secondaryWidth = desktop
    ? Math.min(layout.secondaryWidth, secondaryMax)
    : layout.secondaryWidth;
  const explorer =
    desktop && layout.explorer ? (
      <div className="flex min-h-0 shrink-0" style={{ width: explorerWidth }}>
        {layout.sidebarPosition === "right" && (
          <WorkbenchResizeHandle
            label="Resize Explorer"
            value={explorerWidth}
            min={180}
            max={explorerMax}
            reverse
            onChange={(explorerWidth) => change({ explorerWidth })}
            onReset={() => change({ explorerWidth: 248 })}
          />
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <WorkbenchExplorer
            onClose={() => change({ explorer: false })}
            onLabel={onLabel}
          />
        </div>
        {layout.sidebarPosition === "left" && (
          <WorkbenchResizeHandle
            label="Resize Explorer"
            value={explorerWidth}
            min={180}
            max={explorerMax}
            onChange={(explorerWidth) => change({ explorerWidth })}
            onReset={() => change({ explorerWidth: 248 })}
          />
        )}
      </div>
    ) : null;

  return (
    <div
      className="ide-shell flex h-dvh flex-col overflow-hidden bg-surface-950 text-surface-200"
      data-density={layout.density}
    >
      <WorkbenchTitleBar
        section={label}
        onShortcuts={() => setShowCheatSheet(true)}
        controls={
          <WorkbenchLayoutControls
            layout={layout}
            onChange={change}
            onReset={reset}
            onExplorer={toggleExplorer}
          />
        }
      />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <WorkbenchActivityBar
          expanded={pathname === "/dashboard"}
          onExplorer={toggleExplorer}
          explorerOpen={desktop ? layout.explorer : mobileExplorer}
        />
        {layout.sidebarPosition === "left" && explorer}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <WorkbenchTabs label={section} labels={labels} />
          <main
            id="workbench-editor"
            aria-label="Editor area"
            className="workbench-editor relative flex min-h-0 min-w-0 flex-1 flex-col overflow-auto"
          >
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
          {layout.panel && (
            <div
              className="flex shrink-0 flex-col"
              style={{ height: layout.panelHeight, maxHeight: "45dvh" }}
            >
              <WorkbenchResizeHandle
                label="Resize bottom panel"
                value={layout.panelHeight}
                min={100}
                max={360}
                horizontal
                reverse
                onChange={(panelHeight) => change({ panelHeight })}
                onReset={() => change({ panelHeight: 190 })}
              />
              <div className="min-h-0 flex-1">
                <WorkbenchNotifications
                  onClose={() => change({ panel: false })}
                />
              </div>
            </div>
          )}
        </div>
        {layout.sidebarPosition === "right" && explorer}
        {layout.secondary && (
          <div
            className={
              desktop
                ? "flex min-h-0 shrink-0"
                : "absolute bottom-0 right-0 top-0 z-40 flex max-w-[calc(100vw-3rem)] border-l border-surface-700 shadow-xl"
            }
            style={{ width: secondaryWidth }}
          >
            {desktop && (
              <WorkbenchResizeHandle
                label="Resize secondary sidebar"
                value={secondaryWidth}
                min={220}
                max={secondaryMax}
                reverse
                onChange={(secondaryWidth) => change({ secondaryWidth })}
                onReset={() => change({ secondaryWidth: 272 })}
              />
            )}
            <div className="min-w-0 flex-1">
              <WorkbenchQuickAccess
                pathname={pathname}
                label={label}
                onClose={() => change({ secondary: false })}
              />
            </div>
          </div>
        )}
        {!desktop && mobileExplorer && (
          <>
            <div
              className="absolute inset-0 left-12 z-40 bg-black/40"
              onClick={() => setMobileExplorer(false)}
            />
            <div
              ref={explorerTrapRef}
              role="dialog"
              aria-modal="true"
              aria-label="Explorer"
              className="absolute bottom-0 left-12 top-0 z-50 w-[min(320px,calc(100vw-3rem))] border-r border-surface-700"
            >
              <WorkbenchExplorer
                onClose={() => setMobileExplorer(false)}
                onLabel={onLabel}
              />
            </div>
          </>
        )}
      </div>
      {layout.statusBar && (
        <WorkbenchStatusBar
          section={label}
          onShortcuts={() => setShowCheatSheet(true)}
        />
      )}
      {showCheatSheet && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowCheatSheet(false)}
        >
          <div
            ref={shortcutsTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-dialog-title"
            className="w-full max-w-sm rounded border border-surface-700 bg-surface-900 p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="shortcuts-dialog-title" className="text-sm font-semibold">
                Keyboard shortcuts
              </h2>
              <button
                type="button"
                aria-label="Close keyboard shortcuts"
                onClick={() => setShowCheatSheet(false)}
                className="flex h-8 w-8 items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.keys.join("")}
                  className="flex items-center justify-between"
                >
                  <span className="text-surface-400">
                    {shortcut.description}
                  </span>
                  <kbd className="font-mono text-surface-300">
                    {shortcut.keys.join(" ")}
                  </kbd>
                </div>
              ))}
              {[
                ["Explorer", "Ctrl/⌘ B"],
                ["Bottom panel", "Ctrl/⌘ J"],
                ["Secondary sidebar", "Ctrl/⌘ Alt B"],
              ].map(([title, keys]) => (
                <div key={title} className="flex items-center justify-between">
                  <span className="text-surface-400">{title}</span>
                  <kbd className="font-mono text-surface-300">{keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VerifiedAccess({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/auth/login");
    else if (!user.emailVerifiedAt) router.replace("/auth/check-email");
  }, [user, loading, router]);
  if (loading || !user?.emailVerifiedAt)
    return (
      <div
        role="status"
        className="flex min-h-screen items-center justify-center text-sm text-surface-400"
      >
        Checking your account...
      </div>
    );
  return children;
}
