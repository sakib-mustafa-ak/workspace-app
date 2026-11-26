"use client";

import type { CSSProperties, ReactNode } from "react";
import { useWorkbenchSize } from "@/hooks/use-workbench-size";
import { WorkbenchResizeHandle } from "@/components/workbench-resize-handle";

export function WorkbenchSidePanel({
  children,
  name,
  label,
}: {
  children: ReactNode;
  name: string;
  label: string;
}) {
  const [width, setWidth] = useWorkbenchSize(name, 300, 220, 480);
  return (
    <div
      className="workbench-side-panel flex min-h-0 shrink-0 border-l border-surface-800"
      style={{ "--pane-width": `${width}px` } as CSSProperties}
    >
      <div className="hidden shrink-0 lg:flex">
        <WorkbenchResizeHandle
          label={label}
          value={width}
          min={220}
          max={480}
          reverse
          onChange={setWidth}
          onReset={() => setWidth(300)}
        />
      </div>
      <div className="min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
