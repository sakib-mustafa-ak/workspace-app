"use client";

import { useCallback, useRef, useState } from "react";
import {
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelsTopLeft,
  RotateCcw,
  X,
} from "lucide-react";
import type { WorkbenchLayout } from "@/lib/workbench-layout";
import { useFocusTrap } from "@/hooks/use-focus-trap";

export function WorkbenchLayoutControls({
  layout,
  onChange,
  onReset,
  onExplorer,
}: {
  layout: WorkbenchLayout;
  onChange: (patch: Partial<WorkbenchLayout>) => void;
  onReset: () => void;
  onExplorer: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const trap = useFocusTrap(open, close);
  const controls = [
    {
      label: "Toggle Explorer",
      Icon: PanelLeft,
      active: layout.explorer,
      action: onExplorer,
    },
    {
      label: "Toggle bottom panel",
      Icon: PanelBottom,
      active: layout.panel,
      action: () => onChange({ panel: !layout.panel }),
    },
    {
      label: "Toggle secondary sidebar",
      Icon: PanelRight,
      active: layout.secondary,
      action: () => onChange({ secondary: !layout.secondary }),
    },
  ];
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {controls.map(({ label, Icon, active, action }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          aria-pressed={active}
          title={label}
          onClick={action}
          className={`flex h-8 w-8 items-center justify-center rounded-sm hover:bg-surface-800 ${active ? "text-primary-400" : "text-surface-500"}`}
        >
          <Icon size={16} strokeWidth={1.5} />
        </button>
      ))}
      <button
        ref={trigger}
        type="button"
        aria-label="Customize layout"
        aria-expanded={open}
        title="Customize layout"
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-sm text-surface-400 hover:bg-surface-800"
      >
        <PanelsTopLeft size={16} strokeWidth={1.5} />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-end bg-black/30 p-3 pt-12"
          onClick={() => setOpen(false)}
        >
          <div
            ref={trap}
            role="dialog"
            aria-modal="true"
            aria-label="Customize layout"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded border border-surface-700 bg-surface-900 p-3 text-xs shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <h2 className="font-medium">Customize layout</h2>
              <button
                type="button"
                aria-label="Close layout settings"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center"
              >
                <X size={15} />
              </button>
            </div>
            {(
              [
                ["explorer", "Primary sidebar · Explorer"],
                ["secondary", "Secondary sidebar · Quick access"],
                ["panel", "Bottom panel · Notifications"],
                ["statusBar", "Status bar"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between gap-3 px-2 py-2.5 hover:bg-surface-800"
              >
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={layout[key]}
                  onChange={(event) =>
                    onChange({ [key]: event.target.checked })
                  }
                  className="accent-primary-600"
                />
              </label>
            ))}
            <label className="mt-2 flex items-center justify-between gap-3 border-t border-surface-700 px-2 py-3">
              Explorer position
              <select
                value={layout.sidebarPosition}
                onChange={(event) =>
                  onChange({
                    sidebarPosition: event.target.value as "left" | "right",
                  })
                }
                className="rounded border border-surface-700 bg-surface-950 px-2 py-1.5"
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 px-2 py-2">
              Layout density
              <select
                value={layout.density}
                onChange={(event) =>
                  onChange({
                    density: event.target.value as "default" | "compact",
                  })
                }
                className="rounded border border-surface-700 bg-surface-950 px-2 py-1.5"
              >
                <option value="default">Default</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <p className="px-2 py-3 text-surface-500">
              Drag panel edges to resize. Arrow keys resize focused dividers.
              Your layout is saved on this device.
            </p>
            <button
              type="button"
              onClick={onReset}
              className="flex w-full items-center gap-2 border-t border-surface-700 px-2 pt-3 text-surface-300 hover:text-primary-400"
            >
              <RotateCcw size={14} />
              Reset layout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
