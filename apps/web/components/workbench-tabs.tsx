"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Columns3, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

type Tab = { href: string; label: string };
export function WorkbenchTabs({
  label,
  labels,
}: {
  label: string;
  labels: Record<string, string>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const key = `workbench:tabs:v1:${user?.id ?? ""}`;
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [loaded, setLoaded] = useState("");
  const dragged = useRef<string | null>(null);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? "[]");
      setTabs(
        Array.isArray(saved)
          ? saved
              .filter(
                (tab): tab is Tab =>
                  tab &&
                  typeof tab.href === "string" &&
                  /^\/(dashboard|workspaces|notifications|settings|users|admin|onboarding)(\/|$)/.test(
                    tab.href,
                  ) &&
                  !tab.href.includes("?") &&
                  !tab.href.includes("#") &&
                  typeof tab.label === "string",
              )
              .slice(-11)
          : [],
      );
    } catch {
      setTabs([]);
    }
    setLoaded(key);
  }, [key]);
  const currentLabel = labels[pathname] ?? label;
  useEffect(() => {
    if (loaded !== key) return;
    setTabs((previous) => {
      const next = previous
        .filter((tab) => tab.href !== "/dashboard")
        .map((tab) => ({ ...tab }));
      const existing = next.find((tab) => tab.href === pathname);
      if (existing) existing.label = currentLabel;
      else if (pathname !== "/dashboard")
        next.push({ href: pathname, label: currentLabel });
      const result = [
        { href: "/dashboard", label: "Dashboard" },
        ...next.slice(-11),
      ];
      try {
        sessionStorage.setItem(key, JSON.stringify(result));
      } catch {
        /* Optional session history. */
      }
      return result;
    });
  }, [pathname, currentLabel, loaded, key]);
  function close(href: string) {
    const next = tabs.filter((tab) => tab.href !== href);
    setTabs(next);
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Optional persistence. */
    }
    if (href === pathname)
      router.push(next[next.length - 1]?.href ?? "/dashboard");
  }
  function move(href: string, target: string) {
    if (href === "/dashboard" || target === "/dashboard" || href === target)
      return;
    const from = tabs.findIndex((tab) => tab.href === href);
    const to = tabs.findIndex((tab) => tab.href === target);
    if (from < 0 || to < 0) return;
    const next = [...tabs];
    next.splice(to, 0, next.splice(from, 1)[0]!);
    setTabs(next);
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Optional session history. */
    }
  }
  const visible = tabs.length
    ? tabs
    : [{ href: pathname, label: currentLabel }];
  return (
    <nav
      aria-label="Page tabs"
      className="workbench-tabs flex h-9 shrink-0 overflow-x-auto border-b border-surface-800 bg-workbench-chrome text-xs"
    >
      {visible.map((tab) => (
        <div
          key={tab.href}
          draggable={tab.href !== "/dashboard"}
          onDragStart={(event) => {
            if (tab.href === "/dashboard") return;
            dragged.current = tab.href;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", tab.href);
          }}
          onDragEnd={() => {
            dragged.current = null;
          }}
          onDragOver={(event) => {
            if (dragged.current && tab.href !== "/dashboard")
              event.preventDefault();
          }}
          onDrop={(event) => {
            if (!dragged.current) return;
            event.preventDefault();
            move(dragged.current, tab.href);
            dragged.current = null;
          }}
          className={`group flex max-w-64 shrink-0 items-center border-r border-t-2 border-r-surface-800 ${tab.href === pathname ? "border-t-primary-400 bg-workbench-tab text-surface-200" : "border-t-transparent text-surface-500"}`}
        >
          <Link
            href={tab.href}
            aria-current={tab.href === pathname ? "page" : undefined}
            title={tab.label}
            onKeyDown={(event) => {
              if (
                !event.altKey ||
                !["ArrowLeft", "ArrowRight"].includes(event.key)
              )
                return;
              event.preventDefault();
              event.stopPropagation();
              const index = tabs.findIndex((item) => item.href === tab.href);
              const target = tabs[index + (event.key === "ArrowLeft" ? -1 : 1)];
              if (target) move(tab.href, target.href);
            }}
            className="flex min-w-0 items-center gap-2 px-3 py-2"
          >
            <Columns3 size={12} className="shrink-0 text-primary-400" />
            <span className="truncate">{tab.label}</span>
          </Link>
          {tab.href !== "/dashboard" && (
            <button
              type="button"
              aria-label={`Close ${tab.label} tab`}
              title="Close tab"
              onClick={() => close(tab.href)}
              className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-surface-500 hover:bg-surface-800 hover:text-surface-200"
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}
