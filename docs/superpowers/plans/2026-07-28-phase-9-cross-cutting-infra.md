# Phase 9: Cross-Cutting Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build foundational infrastructure (toast system, confirmation modal, error boundary, auto token refresh) that every other phase depends on.

**Architecture:** React context for toast system, reusable modal component, middleware for token refresh, error boundary higher-order component.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, lucide-react

## Global Constraints

- Toast system and confirmation modal must work across all pages without per-page setup
- Token refresh must be transparent — no changes needed in existing API call sites
- Error boundary must not break the sidebar/navigation when a page crashes

---

### Task 1: Toast notification system

**Files:**
- Create: `apps/web/contexts/toast-context.tsx`
- Create: `apps/web/components/toast.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Create toast context**

```tsx
'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

type Toast = {
  id: string;
  type: ToastType;
  message: string;
  undo?: { label: string; onUndo: () => void };
};

type ToastContextType = {
  toasts: Toast[];
  success: (message: string, undo?: Toast['undo']) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, undo?: Toast['undo']) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message, undo }]);
    const duration = type === 'error' ? 8000 : 4000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, success: (m, u) => addToast('success', m, u), error: (m) => addToast('error', m), info: (m) => addToast('info', m), dismiss }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
```

- [ ] **Step 2: Create toast container component**

```tsx
'use client';

import { useToast } from '@/contexts/toast-context';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const colors = {
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  error: 'border-red-500/20 bg-red-500/10 text-red-400',
  info: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
};

function ToastContainer() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-md animate-slideUp ${colors[toast.type]}`}
          >
            <Icon size={16} className="shrink-0" />
            <span className="flex-1">{toast.message}</span>
            {toast.undo && (
              <button
                onClick={() => { toast.undo!.onUndo(); dismiss(toast.id); }}
                className="font-medium underline underline-offset-2"
              >
                {toast.undo.label}
              </button>
            )}
            <button onClick={() => dismiss(toast.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Wire ToastProvider into root layout**

Modify `apps/web/app/layout.tsx` to wrap children:

```tsx
import { ToastProvider } from '@/contexts/toast-context';
// ...
<body ...>
  <ToastProvider>{children}</ToastProvider>
</body>
```

- [ ] **Step 4: Add slide-up animation to globals.css**

```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-slideUp {
  animation: slideUp 0.2s ease-out;
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/contexts/toast-context.tsx apps/web/components/toast.tsx apps/web/app/layout.tsx apps/web/app/globals.css
git commit -m "feat(ui): add toast notification system with undo support"
```

---

### Task 2: Confirmation modal component

**Files:**
- Create: `apps/web/components/confirm-modal.tsx`

- [ ] **Step 1: Create ConfirmModal component**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-xl border border-surface-800 bg-surface-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          {variant === 'danger' && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-surface-400">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-surface-700 px-4 py-2 text-xs font-medium text-surface-400 transition-colors hover:text-white disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-xs font-medium text-white transition-all disabled:opacity-50 ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-primary-600 hover:bg-primary-500'
            }`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/confirm-modal.tsx
git commit -m "feat(ui): add reusable confirmation modal component"
```

---

### Task 3: Error boundary

**Files:**
- Create: `apps/web/components/error-boundary.tsx`

- [ ] **Step 1: Create error boundary component**

```tsx
'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-full flex-col items-center justify-center p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-red-500/10">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <h2 className="mt-4 text-lg font-bold">Something went wrong</h2>
          <p className="mt-1 text-sm text-surface-400">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Wire ErrorBoundary into authenticated layout**

Modify `apps/web/components/authenticated-layout.tsx` to wrap `{children}` with `<ErrorBoundary>`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/error-boundary.tsx apps/web/components/authenticated-layout.tsx
git commit -m "feat(ui): add error boundary component"
```

---

### Task 4: Auto token refresh middleware

**Files:**
- Modify: `apps/web/lib/api.ts`

- [ ] **Step 1: Add refresh queue and interceptor logic**

Replace the `request` function in `apps/web/lib/api.ts` with one that handles token refresh:

```ts
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearSession();
    throw new Error('Session expired');
  }

  const data = await res.json();
  localStorage.setItem('accessToken', data.accessToken);
  if (data.refreshToken) {
    localStorage.setItem('refreshToken', data.refreshToken);
  }
  return data.accessToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && token) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        refreshQueue.forEach((q) => q.resolve(newToken));
        refreshQueue = [];

        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
      } catch (err) {
        isRefreshing = false;
        refreshQueue.forEach((q) => q.reject(err));
        refreshQueue = [];
        clearSession();
        window.location.href = '/auth/login';
        throw err;
      }
    } else {
      const newToken = await new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      });
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.code || 'UNKNOWN',
      body.message || 'An error occurred',
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/api.ts
git commit -m "feat(auth): add transparent token refresh with request queue"
```

---

### Task 5: Global loading bar

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Add loading bar component**

Add a thin animated bar at the top of the layout that shows during navigation:

```tsx
// In layout.tsx or a new component
'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

function LoadingBar() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] h-0.5">
      <div
        className={`h-full bg-gradient-to-r from-primary-500 to-primary-300 transition-all duration-300 ${
          loading ? 'w-full opacity-100' : 'w-0 opacity-0'
        }`}
      />
    </div>
  );
}
```

- [ ] **Step 2: Wire into layout**

Add `<LoadingBar />` as the first child inside `<body>` in root layout.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat(ui): add global navigation loading bar"
```

---

### Task 6: Keyboard shortcuts

**Files:**
- Create: `apps/web/hooks/use-keyboard-shortcuts.ts`
- Modify: `apps/web/components/authenticated-layout.tsx`

- [ ] **Step 1: Create keyboard shortcuts hook**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Shortcut = {
  keys: string[];
  description: string;
  action: () => void;
};

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let buffer = '';
    let timer: ReturnType<typeof setTimeout>;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        setShowCheatSheet((prev) => !prev);
        return;
      }

      if (e.ctrlKey || e.metaKey || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      buffer += e.key.toLowerCase();
      clearTimeout(timer);
      timer = setTimeout(() => { buffer = ''; }, 1000);

      for (const shortcut of shortcuts) {
        const seq = shortcut.keys.join('').toLowerCase();
        if (buffer.endsWith(seq)) {
          e.preventDefault();
          shortcut.action();
          buffer = '';
          break;
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, router]);

  return { showCheatSheet, setShowCheatSheet };
}
```

- [ ] **Step 2: Create cheat sheet modal**

Add a modal component inline or in the authenticated layout that shows when `?` is pressed:

```tsx
{showCheatSheet && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={() => setShowCheatSheet(false)}>
    <div className="w-full max-w-sm rounded-xl border border-surface-800 bg-surface-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <h3 className="text-sm font-semibold mb-4">Keyboard Shortcuts</h3>
      <div className="space-y-2">
        {allShortcuts.map((s) => (
          <div key={s.keys.join('')} className="flex items-center justify-between text-sm">
            <span className="text-surface-400">{s.description}</span>
            <kbd className="rounded bg-surface-800 px-2 py-0.5 text-xs text-surface-300 font-mono">
              {s.keys.join(' ')}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Register in authenticated layout**

In `authenticated-layout.tsx`, register shortcuts:
```tsx
const shortcuts = [
  { keys: ['g', 'd'], description: 'Go to Dashboard', action: () => router.push('/dashboard') },
  { keys: ['g', 'n'], description: 'Go to Notifications', action: () => router.push('/notifications') },
  { keys: ['g', 's'], description: 'Go to Settings', action: () => router.push('/settings') },
  { keys: ['g', 'u'], description: 'Go to Users', action: () => router.push('/users') },
];
const { showCheatSheet, setShowCheatSheet } = useKeyboardShortcuts(shortcuts);
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/hooks/use-keyboard-shortcuts.ts apps/web/components/authenticated-layout.tsx
git commit -m "feat(ui): add keyboard shortcuts with cheat sheet"
```

---

### Task 7: Responsive / mobile layout

**Files:**
- Modify: `apps/web/components/authenticated-layout.tsx`

- [ ] **Step 1: Audit and fix breakpoints**

The current sidebar is already off-canvas on mobile (`-translate-x-full` + `lg:static`). Verify at 320px:
- Sidebar opens/closes correctly
- Menu button is visible
- Content is readable (no overflow)

Add mobile bottom nav to authenticated layout for screens <768px:

```tsx
// Bottom tab bar for mobile
{
  isMobile && (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-surface-800 bg-surface-950/95 backdrop-blur-md">
      {navItems.slice(0, 4).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
            pathname === item.href ? 'text-primary-400' : 'text-surface-500'
          }`}
        >
          <item.icon size={18} />
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: Add bottom padding to mobile content**

Add `pb-16` to the main content area on mobile to account for the bottom nav.

- [ ] **Step 3: Touch target audit**

Ensure all interactive elements have `min-h-[44px]` or sufficient padding on mobile.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/authenticated-layout.tsx
git commit -m "feat(ui): add mobile bottom nav bar and touch target sizing"
```
