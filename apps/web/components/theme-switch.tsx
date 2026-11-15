"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Color theme"
      className={`flex items-center gap-0.5 rounded-lg border border-surface-700/60 bg-surface-900/60 p-0.5 ${compact ? "shrink-0" : "mb-4"}`}
    >
      {(
        [
          { value: "dark", label: "Dark", Icon: Moon },
          { value: "light", label: "Light", Icon: Sun },
        ] as const
      ).map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={`Use ${label.toLowerCase()} theme`}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          className={`flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${compact ? "" : "flex-1"} ${theme === value ? "bg-surface-800 text-primary-400 shadow-sm" : "text-surface-400 hover:text-surface-200"}`}
        >
          <Icon size={14} aria-hidden="true" />
          <span className={compact ? "sr-only sm:not-sr-only" : ""}>
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
