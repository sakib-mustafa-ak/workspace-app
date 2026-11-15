import type { ReactNode } from "react";
import { WorkspaceLogo } from "@/components/workspace-logo";
import { ThemeSwitch } from "@/components/theme-switch";

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-surface-950">
      <div className="relative hidden flex-1 items-center justify-center border-r border-surface-800/70 lg:flex">
        <div
          className="relative px-16 animate-fadeUp"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="mb-6">
            <WorkspaceLogo className="h-14 w-14" />
          </div>
          <p className="text-3xl font-bold text-surface-100">Workspace OS</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-surface-400">
            A collaborative workspace — teams, boards, tasks, canvas, and
            notifications in one place.
          </p>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <ThemeSwitch />
          {children}
        </div>
      </div>
    </div>
  );
}
