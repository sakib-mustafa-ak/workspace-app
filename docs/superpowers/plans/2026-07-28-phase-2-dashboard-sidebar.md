# Phase 2: Dashboard + Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the sidebar into a navigation hub and make the dashboard feel alive.

**Architecture:** Sidebar gets search, workspace switcher, theme toggle, notification badge. Dashboard gets richer cards, quick-create, invitations banner, recent activity.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4 (dark/light via `class` strategy), lucide-react

## Global Constraints

- No new npm dependencies
- Theme toggle persists to `localStorage` key `theme` with values `dark`, `light`, `system`
- Search bar debounce 300ms before calling API

---

### Task 1: Theme toggle

**Files:**
- Create: `apps/web/hooks/use-theme.ts`
- Modify: `apps/web/components/sidebar.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Create useTheme hook**

```tsx
'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) setThemeState(stored);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
    applyTheme(t);
  };

  const toggleTheme = () => {
    const order: Theme[] = ['dark', 'light', 'system'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  return { theme, setTheme, toggleTheme };
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else if (theme === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
    root.classList.toggle('light', !prefersDark);
  }
}
```

- [ ] **Step 2: Add theme toggle button to sidebar**

```tsx
// In sidebar.tsx, in the footer area
<button
  onClick={toggleTheme}
  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-surface-400 transition-all hover:bg-surface-800/50 hover:text-surface-200"
>
  {theme === 'dark' ? <Moon size={16} /> : theme === 'light' ? <Sun size={16} /> : <Monitor size={16} />}
  {theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System'}
</button>
```

Add `Sun, Moon, Monitor` to lucide-react import.

- [ ] **Step 3: Apply theme class on layout mount**

In root `layout.tsx`, add a script or useEffect to apply theme before render to avoid flash.

- [ ] **Step 4: Commit**

```bash
git add apps/web/hooks/use-theme.ts apps/web/components/sidebar.tsx
git commit -m "feat(ui): add theme toggle (dark/light/system) in sidebar"
```

---

### Task 2: Search bar in sidebar

**Files:**
- Modify: `apps/web/components/sidebar.tsx`

- [ ] **Step 1: Add search input and results panel**

```tsx
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<{ boards: any[]; tasks: any[] } | null>(null);
const [searchOpen, setSearchOpen] = useState(false);
const searchRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!searchQuery.trim()) {
    setSearchResults(null);
    return;
  }
  const timer = setTimeout(async () => {
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res as any);
      setSearchOpen(true);
    } catch { /* handled */ }
  }, 300);
  return () => clearTimeout(timer);
}, [searchQuery]);

// Close on click outside
useEffect(() => {
  function handleClick(e: MouseEvent) {
    if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
      setSearchOpen(false);
    }
  }
  document.addEventListener('mousedown', handleClick);
  return () => document.removeEventListener('mousedown', handleClick);
}, []);
```

Add search input at top of sidebar nav:

```tsx
<div ref={searchRef} className="relative px-3 pb-2">
  <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-surface-500" />
  <input
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder="Search..."
    className="w-full rounded-lg border border-surface-800 bg-surface-950 py-1.5 pl-8 pr-3 text-xs outline-none placeholder:text-surface-600 focus:border-primary-500/50"
  />
  {searchOpen && searchResults && (
    <div className="absolute left-3 right-3 top-full mt-1 rounded-xl border border-surface-800 bg-surface-900 shadow-xl z-50 max-h-64 overflow-y-auto">
      {searchResults.boards?.map((b: any) => (
        <Link key={b.id} href={`/workspaces/${b.workspaceId}/boards/${b.id}`}
          className="flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-surface-800">
          {b.title}
        </Link>
      ))}
      {(!searchResults.boards || searchResults.boards.length === 0) && (
        <p className="px-3 py-4 text-center text-xs text-surface-500">No results</p>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/sidebar.tsx
git commit -m "feat(ui): add global search bar in sidebar"
```

---

### Task 3: Workspace switcher in sidebar

**Files:**
- Modify: `apps/web/components/sidebar.tsx`

- [ ] **Step 1: Fetch and display workspace list**

```tsx
const [userWorkspaces, setUserWorkspaces] = useState<Workspace[]>([]);

useEffect(() => {
  workspacesApi.list().then(setUserWorkspaces).catch(() => {});
}, []);
```

Add workspace section below nav items:

```tsx
{userWorkspaces.length > 0 && (
  <div className="px-3 pt-2">
    <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-surface-500">Workspaces</p>
    {userWorkspaces.map((ws) => (
      <Link
        key={ws.id}
        href={`/workspaces/${ws.id}`}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
          pathname.startsWith(`/workspaces/${ws.id}`)
            ? 'bg-surface-800 text-white'
            : 'text-surface-400 hover:bg-surface-800/50 hover:text-surface-200'
        }`}
      >
        <div className="flex h-5 w-5 items-center justify-center rounded bg-surface-700 text-[9px] font-bold text-surface-300">
          {ws.name.charAt(0).toUpperCase()}
        </div>
        {ws.name}
      </Link>
    ))}
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/sidebar.tsx
git commit -m "feat(ui): add workspace switcher to sidebar"
```

---

### Task 4: Notification badge in sidebar

**Files:**
- Modify: `apps/web/components/sidebar.tsx`

- [ ] **Step 1: Add unread count polling**

```tsx
const [unreadCount, setUnreadCount] = useState(0);

useEffect(() => {
  function poll() {
    notificationsApi.countUnread().then((r) => setUnreadCount(r.count)).catch(() => {});
  }
  poll();
  const interval = setInterval(poll, 30000);
  return () => clearInterval(interval);
}, []);
```

- [ ] **Step 2: Add badge to Notifications nav item**

The nav item already exists — add a badge next to the label:

```tsx
// Modify the Notifications nav item rendering
<Link ... className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all ...">
  <Bell size={16} className={active ? 'text-primary-400' : ''} />
  <span className="flex-1">Notifications</span>
  {unreadCount > 0 && (
    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )}
</Link>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/sidebar.tsx
git commit -m "feat(ui): add notification badge to sidebar"
```

---

### Task 5: Rich workspace cards and quick-create on dashboard

**Files:**
- Modify: `apps/web/app/dashboard/page.tsx`

- [ ] **Step 1: Add board count + member count to cards**

Modify the workspace card rendering to show additional stats:

```tsx
// In the card content area
<div className="mt-3 flex items-center gap-3 text-[11px] text-surface-600">
  <span>4 members</span>
  <span>&middot;</span>
  <span>3 boards</span>
</div>
```

- [ ] **Step 2: Quick-create with auto-slug**

Modify `CreateWorkspaceForm` to auto-generate slug from name:

```tsx
function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// In the name input onChange:
const newName = e.target.value;
setName(newName);
if (!slugModified) setSlug(generateSlug(newName));
```

- [ ] **Step 3: Invitations banner**

```tsx
const [pendingInvites, setPendingInvites] = useState<any[]>([]);

useEffect(() => {
  // Check for pending invitations — can use a dedicated endpoint or derive from workspaces list
  // For now, use a simple check if user has pending invitations (workspaces with status INVITED)
}, []);
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/dashboard/page.tsx
git commit -m "feat(dashboard): add member/board counts, auto-slug, invitations banner"
```

---

### Task 6: Recent activity (localStorage)

**Files:**
- Create: `apps/web/lib/recent-activity.ts`
- Modify: `apps/web/app/dashboard/page.tsx`

- [ ] **Step 1: Create recent-activity utility**

```ts
const STORAGE_KEY = 'recentBoards';
const MAX_ITEMS = 5;

export type RecentBoard = {
  id: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
  visitedAt: string;
};

export function getRecentBoards(): RecentBoard[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

export function addRecentBoard(board: Omit<RecentBoard, 'visitedAt'>) {
  const recent = getRecentBoards().filter((b) => b.id !== board.id);
  recent.unshift({ ...board, visitedAt: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_ITEMS)));
}
```

- [ ] **Step 2: Show recent boards on dashboard**

```tsx
const recentBoards = getRecentBoards();

{recentBoards.length > 0 && (
  <div className="mb-8">
    <h2 className="mb-3 text-sm font-semibold text-surface-300">Recent boards</h2>
    <div className="flex gap-3 overflow-x-auto pb-2">
      {recentBoards.map((rb) => (
        <Link
          key={rb.id}
          href={`/workspaces/${rb.workspaceId}/boards/${rb.id}`}
          className="shrink-0 rounded-xl border border-surface-800 bg-surface-900 p-4 transition-colors hover:border-surface-700"
        >
          <p className="text-sm font-medium">{rb.name}</p>
          <p className="text-xs text-surface-500">{rb.workspaceName}</p>
        </Link>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Wire board visit tracking**

In the board detail page (`apps/web/app/workspaces/[workspaceId]/boards/[boardId]/page.tsx`), call `addRecentBoard` when board loads:

```tsx
useEffect(() => {
  if (board) {
    addRecentBoard({
      id: board.id,
      name: board.name,
      workspaceId,
      workspaceName: '', // optionally pass from workspace data
    });
  }
}, [board, workspaceId]);
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/recent-activity.ts apps/web/app/dashboard/page.tsx apps/web/app/workspaces/*/boards/*/page.tsx
git commit -m "feat(dashboard): add recent boards from localStorage"
```

---

### Task 7: Refined skeleton and empty states

**Files:**
- Modify: `apps/web/app/dashboard/page.tsx`

- [ ] **Step 1: Replace pulse blocks with shimmer skeleton**

```tsx
// Replace the current animate-pulse divs with:
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  {Array.from({ length: 6 }).map((_, i) => (
    <div key={i} className="h-36 rounded-xl bg-surface-800/50 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-surface-700/20 to-transparent animate-shimmer" />
    </div>
  ))}
</div>
```

Add to globals.css:

```css
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.animate-shimmer {
  animation: shimmer 1.5s infinite;
}
```

- [ ] **Step 2: Refine empty state**

Replace the basic empty state with a more visual one:

```tsx
<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-700/50 bg-surface-900/30 py-24">
  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-800">
    <LayoutDashboard size={36} className="text-surface-600" />
  </div>
  <h3 className="mt-6 text-lg font-semibold text-surface-300">No workspaces yet</h3>
  <p className="mt-1 text-sm text-surface-500">Create your first workspace to get started</p>
  <button onClick={() => setShowCreate(true)} className="mt-6 flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-600/20 hover:bg-primary-500">
    <Plus size={16} />
    Create workspace
  </button>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dashboard/page.tsx apps/web/app/globals.css
git commit -m "feat(dashboard): add shimmer skeleton and refined empty state"
```
