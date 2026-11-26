"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { clampSize } from "@/lib/workbench-layout";

export function useWorkbenchSize(
  name: string,
  initial: number,
  min: number,
  max: number,
) {
  const { user } = useAuth();
  const key = `workbench:size:v1:${user?.id ?? ""}:${name}`;
  const [size, setSize] = useState(initial);
  const [loaded, setLoaded] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      const value = raw === null ? initial : Number(raw);
      setSize(Number.isFinite(value) ? clampSize(value, min, max) : initial);
    } catch {
      setSize(initial);
    }
    setLoaded(key);
  }, [key, initial, min, max]);
  useEffect(() => {
    if (loaded !== key) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, String(size));
      } catch {
        /* Optional preference. */
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [key, loaded, size]);
  return [size, setSize] as const;
}
