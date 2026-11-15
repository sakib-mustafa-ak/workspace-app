import Image from "next/image";
import type { ReactNode } from "react";
import { WorkspaceLogo } from "@/components/workspace-logo";
import { ThemeSwitch } from "@/components/theme-switch";

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 hidden sm:block">
        <Image
          src="/bg-desktop.webp"
          alt=""
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
      </div>
      <div className="pointer-events-none absolute inset-0 sm:hidden">
        <Image
          src="/bg-mobile.webp"
          alt=""
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-surface-950/88" />

      <div className="relative hidden flex-1 items-center justify-center overflow-hidden lg:flex">
        <div className="pointer-events-none absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-primary-400/10 blur-3xl animate-drift" />
        <div
          className="pointer-events-none absolute bottom-1/4 right-10 h-96 w-96 rounded-full bg-primary-500/10 blur-3xl animate-drift"
          style={{ animationDelay: "-6s" }}
        />
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
