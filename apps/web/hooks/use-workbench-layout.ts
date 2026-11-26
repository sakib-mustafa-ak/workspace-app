"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  DEFAULT_WORKBENCH_LAYOUT,
  parseWorkbenchLayout,
} from "@/lib/workbench-layout";

export function useWorkbenchLayout() {
  const { user } = useAuth();
  const storageKey = `workbench:layout:v1:${user?.id ?? ""}`;
  const [layout, setLayout] = useState(DEFAULT_WORKBENCH_LAYOUT);
  const [loadedKey, setLoadedKey] = useState("");
  useEffect(() => {
    try {
      setLayout(
        parseWorkbenchLayout(
          JSON.parse(localStorage.getItem(storageKey) ?? "null"),
        ),
      );
    } catch {
      setLayout({ ...DEFAULT_WORKBENCH_LAYOUT });
    }
    setLoadedKey(storageKey);
  }, [storageKey]);
  useEffect(() => {
    if (loadedKey !== storageKey) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(layout));
      } catch {
        /* Optional persistence. */
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [layout, loadedKey, storageKey]);
  return {
    layout,
    setLayout,
    reset: () => setLayout({ ...DEFAULT_WORKBENCH_LAYOUT }),
  };
}
