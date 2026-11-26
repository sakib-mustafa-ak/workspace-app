export type WorkbenchLayout = {
  explorer: boolean;
  secondary: boolean;
  panel: boolean;
  statusBar: boolean;
  sidebarPosition: "left" | "right";
  density: "default" | "compact";
  explorerWidth: number;
  secondaryWidth: number;
  panelHeight: number;
};

export const DEFAULT_WORKBENCH_LAYOUT: WorkbenchLayout = {
  explorer: true,
  secondary: false,
  panel: false,
  statusBar: true,
  sidebarPosition: "left",
  density: "default",
  explorerWidth: 248,
  secondaryWidth: 272,
  panelHeight: 190,
};

export function clampSize(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function parseWorkbenchLayout(value: unknown): WorkbenchLayout {
  const result = { ...DEFAULT_WORKBENCH_LAYOUT };
  if (!value || typeof value !== "object") return result;
  const saved = value as Record<string, unknown>;
  for (const key of ["explorer", "secondary", "panel", "statusBar"] as const) {
    if (typeof saved[key] === "boolean") result[key] = saved[key];
  }
  if (saved.sidebarPosition === "left" || saved.sidebarPosition === "right")
    result.sidebarPosition = saved.sidebarPosition;
  if (saved.density === "default" || saved.density === "compact")
    result.density = saved.density;
  for (const [key, min, max] of [
    ["explorerWidth", 180, 400],
    ["secondaryWidth", 220, 420],
    ["panelHeight", 100, 360],
  ] as const) {
    const size = saved[key];
    if (typeof size === "number" && Number.isFinite(size))
      result[key] = clampSize(size, min, max);
  }
  return result;
}
