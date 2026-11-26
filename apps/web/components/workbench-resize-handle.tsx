"use client";

import { useRef } from "react";
import { clampSize } from "@/lib/workbench-layout";

export function WorkbenchResizeHandle({
  label,
  value,
  min,
  max,
  onChange,
  horizontal = false,
  reverse = false,
  onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  horizontal?: boolean;
  reverse?: boolean;
  onReset?: () => void;
}) {
  const start = useRef<{
    pointer: number;
    position: number;
    value: number;
  } | null>(null);
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={horizontal ? "horizontal" : "vertical"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      title={`${label}: drag or use arrow keys${onReset ? "; double-click to reset" : ""}`}
      className={`workbench-resizer ${horizontal ? "workbench-resizer-horizontal" : ""}`}
      onDoubleClick={onReset}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        start.current = {
          pointer: event.pointerId,
          position: horizontal ? event.clientY : event.clientX,
          value,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!start.current || event.pointerId !== start.current.pointer) return;
        const delta =
          (horizontal ? event.clientY : event.clientX) - start.current.position;
        onChange(
          clampSize(start.current.value + delta * (reverse ? -1 : 1), min, max),
        );
      }}
      onPointerUp={(event) => {
        start.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onLostPointerCapture={() => {
        start.current = null;
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      onKeyDown={(event) => {
        const increase = horizontal ? "ArrowDown" : "ArrowRight";
        const decrease = horizontal ? "ArrowUp" : "ArrowLeft";
        if (![increase, decrease, "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        onChange(
          event.key === "Home"
            ? min
            : event.key === "End"
              ? max
              : clampSize(
                  value +
                    (event.key === increase ? 16 : -16) * (reverse ? -1 : 1),
                  min,
                  max,
                ),
        );
      }}
    />
  );
}
