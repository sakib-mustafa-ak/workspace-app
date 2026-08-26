# Design System Hardening — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the specific design system inconsistencies flagged in the Phase 0 audit — dead code, broken light theme, inconsistent tokens, missing loading/toast/a11y patterns — without a generic redesign pass.

**Architecture:** Tailwind v4 with CSS-first config in `globals.css`. All theme tokens live in the `@theme` block. Light theme switches via `.light` class on `<html>`. Components use Tailwind utility classes referencing these tokens. The fix refactors the light theme from fragile `.light .<utility>` overrides to proper CSS variable swaps, establishes semantic type/spacing/elevation tokens, and wires up the unused toast/confirm systems.

**Tech Stack:** Next.js (App Router), Tailwind CSS v4 (CSS-first), React 19, TypeScript, lucide-react icons

**Spec:** This plan implements the 12 items from the user's design phase spec, confirming charcoal+lavender as the palette direction.

## Global Constraints

- Tailwind v4 — no `tailwind.config.*`, all tokens in `globals.css` `@theme` block
- Geist font family (local woff2), no external font loading
- Dark-first: dark is default, `.light` class on `<html>` for light mode
- No new dependencies unless absolutely necessary
- 4px-unit spacing rhythm
- Motion: 150–350ms ease-out only, no bouncy easing
- All changes in `apps/web/` unless noted

---

## Task 1: Delete Dead Scaffold

Remove unused boilerplate that adds noise and misleading marketing links.

**Files:**
- Delete: `packages/ui/` (entire directory — untouched create-turbo scaffold, imported nowhere)
- Delete: `apps/web/app/page.module.css` (leftover create-turbo CSS)
- Delete: `apps/web/tailwindcss-206358.log` (temp log file)
- Delete: `apps/web/public/turborepo-light.svg`
- Delete: `apps/web/public/turborepo-dark.svg`
- Delete: `apps/web/public/globe.svg`
- Delete: `apps/web/public/next.svg`
- Delete: `apps/web/public/window.svg`
- Delete: `apps/web/public/vercel.svg`
- Delete: `apps/web/public/file-text.svg`
- Modify: `apps/web/package.json` — remove `"@repo/ui": "workspace:*"` from dependencies
- Modify: `turbo.json` — remove `@repo/ui` from pipeline packages if referenced
- Modify: root `package.json` — remove `packages/ui` from workspaces if listed

- [ ] **Step 1: Verify packages/ui is truly unused**

```bash
cd /home/sakib_mustafa/Projects/workspace-app
grep -r "@repo/ui" apps/web/ --include="*.tsx" --include="*.ts" --include="*.js"
# Expected: no results
```

- [ ] **Step 2: Delete packages/ui**

```bash
rm -rf packages/ui
```

- [ ] **Step 3: Delete leftover scaffold files**

```bash
rm apps/web/app/page.module.css
rm apps/web/tailwindcss-206358.log
rm apps/web/public/turborepo-light.svg apps/web/public/turborepo-dark.svg
rm apps/web/public/globe.svg apps/web/public/next.svg
rm apps/web/public/window.svg apps/web/public/vercel.svg apps/web/public/file-text.svg
```

- [ ] **Step 4: Remove @repo/ui dependency**

Edit `apps/web/package.json`: remove `"@repo/ui": "workspace:*"` from dependencies.

- [ ] **Step 5: Update workspace references**

Check root `package.json` workspaces array and `turbo.json` for `@repo/ui` references. Remove if present.

- [ ] **Step 6: Verify build**

```bash
cd apps/web && pnpm run build 2>&1 | tail -5
# Expected: builds without errors
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: delete unused packages/ui scaffold and stock assets"
```

---

## Task 2: Fix Light Theme — Proper CSS Variable System

Replace the fragile `.light .<utility>` overrides (globals.css:168-229) with proper CSS custom properties that swap per-theme. This is the foundation for everything else in this phase.

**Files:**
- Modify: `apps/web/app/globals.css` — refactor light theme to use semantic CSS variables
- Modify: `apps/web/components/workspace-logo.tsx` — replace violet gradient with palette-matching primary gradient

**Design decision:** Palette is charcoal+lavender (confirmed). The frontmatter blue/slate tokens in DESIGN.md will be corrected in Task 8. The violet logo gradient (#a78bfa→#6d28d9) will become a primary-500→primary-700 gradient to match the design system.

### Approach

The current system has two layers:
1. `.light { --color-surface-*: ... }` — redefines CSS variables (correct approach)
2. `.light .bg-primary-600 { background-color: ... }` — patches individual utility classes (fragile)

The fix: add semantic CSS custom properties (e.g., `--surface-page`, `--surface-card`, `--surface-raised`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--accent-soft`) that resolve to different values under `.light` vs default (dark). Components should reference these semantic tokens, not raw palette values.

However, since this is an existing codebase with 200+ uses of `bg-surface-900`, `text-surface-100`, etc., we cannot rewrite every component in one pass. The pragmatic approach:

1. Add the semantic layer as CSS variables in `:root` / `.light`
2. Keep existing Tailwind token overrides working (surface-*, primary-* still function)
3. Eliminate the fragile `.light .<utility>` patches by making the Tailwind tokens themselves theme-aware via CSS variable redefinition
4. New components use semantic tokens; existing ones keep working

- [ ] **Step 1: Refactor globals.css light theme**

Replace the current `.light` block (lines 168-229) with a clean variable-swap approach. The `@theme` block defines dark defaults. The `.light` block redefines the same `--color-*` variables. No more manual utility patches.

Current fragile approach (to remove):
```css
.light .bg-primary-600 { background-color: #4a4454; }
.light .bg-primary-600\/20 { background-color: rgb(74 68 84 / 0.2); }
/* ... 20+ more fragile overrides */
```

New approach — the `@theme` tokens already map to CSS variables. Under `.light`, we redefine those same variables:
```css
.light {
  --color-surface-50: #1a1a1a;
  --color-surface-100: #242424;
  /* ... same scale flip as current ... */
  --color-primary-400: #6e637e;
  /* ... same accent shift as current ... */
}
/* DELETE all .light .<utility> overrides — they become unnecessary
   because Tailwind utilities reference --color-* which already swapped */
```

The key insight: Tailwind v4 utilities like `bg-primary-600` resolve to `var(--color-primary-600)`. When `.light` redefines `--color-primary-600`, the utility automatically picks up the new value. No `.light .bg-primary-600` override needed.

- [ ] **Step 2: Test light theme manually**

Start dev server, toggle between dark and light mode, verify:
- Sidebar background flips correctly
- Cards, inputs, modals all adapt
- Text contrast is readable in both themes
- No white-on-white or black-on-black elements

- [ ] **Step 3: Fix workspace-logo.tsx violet gradient**

In `apps/web/components/workspace-logo.tsx`, replace:
```tsx
<stop offset="0%" stopColor="#a78bfa" />
<stop offset="100%" stopColor="#6d28d9" />
```
With:
```tsx
<stop offset="0%" stopColor="#b9b0c8" />   {/* primary-500 */}
<stop offset="100%" stopColor="#2e2e2e" />  {/* primary-600 */}
```
This keeps the gradient logo mark but uses palette colors.

- [ ] **Step 4: Verify build**

```bash
cd apps/web && pnpm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/globals.css apps/web/components/workspace-logo.tsx
git commit -m "fix(css): refactor light theme to use CSS variable swaps, fix logo gradient"
```

---

## Task 3: Define Semantic Type Scale

Establish an explicit type scale with semantic tokens, replacing arbitrary sizes and undefined utilities.

**Files:**
- Modify: `apps/web/app/globals.css` — add semantic type utility classes
- Modify: `apps/web/components/authenticated-layout.tsx` — remove inline `<style>` block (tb-x-3), replace with Tailwind
- Modify: ~20 files with `text-[10px]` — replace with semantic tokens
- Modify: 4 files with `text-label` — replace with real class
- Modify: 1 file with `scrollbar-none` — replace with real class

### Type Scale (from DESIGN.md)

| Semantic Token | Size | Weight | Use |
|---|---|---|---|
| `text-display` | 24px | 700 | Page-level headings |
| `text-headline` | 20px | 600 | Section titles |
| `text-title` | 16px | 600 | Card titles, entity names |
| `text-body` | 14px | 400 | Work text, lists, buttons |
| `text-label` | 12px | 400 | Inputs, meta, file metadata |
| `text-caption` | 10px | 500 | Section labels, uppercase tracking |

Map to Tailwind: `text-display` = `text-2xl font-bold`, `text-headline` = `text-xl font-semibold`, `text-title` = `text-base font-semibold`, `text-body` = `text-sm font-normal`, `text-label` = `text-xs font-normal`, `text-caption` = `text-[10px] font-medium uppercase tracking-widest`.

- [ ] **Step 1: Add semantic type utilities to globals.css**

Add after the animations section in globals.css:
```css
/* Semantic type scale (DESIGN.md hierarchy) */
@layer utilities {
  .text-display { @apply text-2xl font-bold leading-tight; }
  .text-headline { @apply text-xl font-semibold leading-snug; }
  .text-title { @apply text-base font-semibold; }
  .text-body { @apply text-sm font-normal leading-normal; }
  .text-label { @apply text-xs; }
  .text-caption { @apply text-[10px] font-medium uppercase tracking-widest; }
}
```

- [ ] **Step 2: Fix authenticated-layout.tsx inline styles**

Remove the inline `<style>` block (tb-x-3, tb-x-3-name, tb-x-3-sub) and replace with Tailwind classes:
- `tb-x-3` → `h-20` (5rem = 80px)
- `tb-x-3-name` → `text-xl font-bold uppercase tracking-[0.26em]`
- `tb-x-3-sub` → `text-[11px] font-medium uppercase tracking-[0.26em] mt-1.5`

- [ ] **Step 3: Replace text-label (4 occurrences)**

`text-label` is used in:
- `app/dashboard/page.tsx` (lines 308, 357)
- `app/workspaces/.../canvas/page.tsx` (line 69)
- `components/sidebar.tsx` (line 181)

Replace each with the new semantic `.text-label` class (now defined in Step 1).

- [ ] **Step 4: Replace scrollbar-none (1 occurrence)**

`app/dashboard/page.tsx` line 309 — replace with inline style or standard Tailwind: `[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`.

- [ ] **Step 5: Replace text-[10px] with semantic tokens (42 occurrences)**

Go through all 20 files. Classify each use:
- **Badge/counter text** → `text-caption` (the new semantic class)
- **Canvas toolbar labels** → `text-caption`
- **Comment timestamps** → `text-caption`
- **Mobile nav labels** → `text-caption`
- **Calendar date labels** → `text-caption`
- **Keyboard shortcut hints** → `text-caption`

Also replace 11 instances of `text-[11px]` with `text-xs` (12px) — there's no 11px in the scale, and the 1px difference is imperceptible.

- [ ] **Step 6: Verify build**

```bash
cd apps/web && pnpm run build 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix(typography): add semantic type scale, remove inline styles, fix undefined utilities"
```

---

## Task 4: Standardize Elevation and Spacing

Collapse shadow and padding chaos into consistent patterns matching DESIGN.md's documented tiers.

**Files:**
- Modify: ~10 component files — standardize card/modal/panel padding
- Modify: ~15 component files — standardize shadow usage
- Modify: `DESIGN.md` — update frontmatter to match actual palette

### Elevation Tiers (from DESIGN.md)

| Tier | Use | Implementation |
|---|---|---|
| Resting seam | Default card separation | `border border-surface-800/50` (no shadow) |
| Nav active | Selected nav row | `shadow-sm` |
| Hover glow | Primary buttons on hover | `shadow-lg shadow-primary-600/25` |
| Float | Dropdowns, search results | `shadow-xl` |
| Glass depth | Auth/hero panels only | `shadow-2xl` |

### Spacing Convention

| Concept | Padding | Where |
|---|---|---|
| Card content | `p-4` | All cards, panels, tab panes |
| Modal content | `p-6` | Modal bodies (not headers) |
| Compact list item | `p-3` | Task cards, sidebar nav items, comments |
| Auth glass panel | `p-6 sm:p-8` | Login, register, reset-password |
| Page padding | `px-6 py-4` | Main content area |

- [ ] **Step 1: Standardize card padding**

Audit all card-like elements. Current state: p-4, p-5, p-6, p-8 all used for "card" concept. Standardize to `p-4` for standard cards (DESIGN.md says "16px standard"). Auth glass panels keep `p-6 sm:p-8`.

Files to check: all page components, settings tabs, workspace detail tabs, board list cards.

- [ ] **Step 2: Standardize shadow usage**

Audit all shadow usage against the 5-tier vocabulary. Specifically:
- Cards at rest: should have NO shadow, only `border border-surface-800/50`
- Cards on hover: add `shadow-lg` (if interactive)
- Dropdowns/popovers: `shadow-xl`
- Modals: `shadow-xl shadow-black/20` (not shadow-2xl — that's for auth glass only)
- Primary button hover: `shadow-lg shadow-primary-600/25`

Files: `task-modal.tsx`, `confirm-modal.tsx`, `ai-ideas-dialog.tsx`, sidebar dropdowns, context-menu, calendar-dropdown.

- [ ] **Step 3: Update DESIGN.md frontmatter**

Replace the blue/slate color tokens in the YAML frontmatter with the actual charcoal+lavender values used in code:

```yaml
colors:
  primary: "#2e2e2e"
  primary-bright: "#3a3a3a"
  primary-soft: "#b9b0c8"
  primary-deep: "#1a1a1a"
  surface: "#121212"
  surface-panel: "#1a1a1a"
  surface-raised: "#242424"
  surface-edge: "#2e2e2e"
  text: "#f4f1f8"
  text-muted: "#9b93a8"
  text-faint: "#7a7385"
  danger: "#ef4444"
  danger-soft: "#f87171"
  success: "#34d399"
  warning: "#fbbf24"
  accent: "#d6cfe1"
```

- [ ] **Step 4: Verify build**

```bash
cd apps/web && pnpm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(elevation): standardize shadow/spacing tiers, align DESIGN.md with code"
```

---

## Task 5: Skeleton Loaders and Loading States

Remove the fake 300ms progress bar. Extend real skeleton loaders to all data-heavy screens.

**Files:**
- Delete/modify: `apps/web/app/loading-bar.tsx` — remove fake progress bar
- Modify: `apps/web/app/layout.tsx` — remove LoadingBar import
- Create: `apps/web/components/skeleton.tsx` — reusable skeleton primitives
- Modify: ~8 page files — add skeleton loading states

### Skeleton Primitives

Create a small `components/skeleton.tsx` with:
- `SkeletonBlock` — rectangular pulse placeholder
- `SkeletonText` — text line placeholder (variable width)
- `SkeletonCircle` — circular placeholder (avatars, icons)
- `SkeletonCard` — card-shaped placeholder with optional content lines

All use `animate-pulse bg-surface-800/50 rounded` pattern already established in the codebase.

- [ ] **Step 1: Create skeleton.tsx component**

```tsx
// components/skeleton.tsx
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-800/50 ${className}`} />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} className="h-3 rounded" style={{ width: `${70 + Math.random() * 30}%` }} />
      ))}
    </div>
  );
}

export function SkeletonCircle({ size = 40 }: { size?: number }) {
  return <SkeletonBlock className="rounded-full" style={{ width: size, height: size }} />;
}
```

- [ ] **Step 2: Remove fake loading bar**

Delete `apps/web/app/loading-bar.tsx`. In `apps/web/app/layout.tsx`, remove the `LoadingBar` import and `<LoadingBar />` render.

- [ ] **Step 3: Add skeleton to Board Detail page**

`app/workspaces/[workspaceId]/boards/[boardId]/page.tsx` — replace the spinner with a skeleton matching the board layout (column headers + task cards).

- [ ] **Step 4: Add skeleton to Workspace Detail page**

`app/workspaces/[workspaceId]/page.tsx` — replace spinner with skeleton (workspace header + tab content placeholder).

- [ ] **Step 5: Add skeleton to Boards List page**

`app/workspaces/[workspaceId]/boards/page.tsx` — replace spinner with grid of skeleton cards.

- [ ] **Step 6: Add skeleton to Notifications page**

`app/notifications/page.tsx` — replace spinner with list of skeleton notification items.

- [ ] **Step 7: Verify build**

```bash
cd apps/web && pnpm run build 2>&1 | tail -5
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "fix(loading): remove fake progress bar, add skeleton loaders to data-heavy screens"
```

---

## Task 6: Wire Up Toast System and Replace Native confirm()

Connect the existing toast system to all mutation failures. Replace all 6 native `confirm()` calls with the existing `ConfirmModal` component.

**Files:**
- Modify: `apps/web/components/task-modal.tsx` — wire toast.error + use ConfirmModal
- Modify: `apps/web/app/workspaces/[workspaceId]/page.tsx` — wire toast + ConfirmModal
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/page.tsx` — wire toast + ConfirmModal
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/page.tsx` — wire toast + ConfirmModal
- Modify: `apps/web/app/workspaces/[workspaceId]/_components/members-tab.tsx` — wire toast + ConfirmModal
- Modify: `apps/web/app/workspaces/[workspaceId]/_components/settings-tab.tsx` — wire toast + ConfirmModal
- Modify: ~10 more files — replace empty catch blocks with toast.error

### Strategy

**For catch blocks:** Replace `catch { /* handled */ }` with:
```tsx
catch (e) {
  toast.error('Failed to [action]. Please try again.');
}
```

**For confirm() calls:** Replace with ConfirmModal pattern:
```tsx
const [confirmOpen, setConfirmOpen] = useState(false);
// In JSX:
<ConfirmModal
  isOpen={confirmOpen}
  onConfirm={handleDelete}
  onCancel={() => setConfirmOpen(false)}
  title="Delete board?"
  message="This action cannot be undone."
  confirmLabel="Delete"
  variant="danger"
/>
// In handler:
const handleDelete = async () => {
  try {
    await api.delete();
    toast.success('Deleted successfully.');
    setConfirmOpen(false);
  } catch {
    toast.error('Failed to delete. Please try again.');
  }
};
```

- [ ] **Step 1: Fix task-modal.tsx (5 catch blocks + 1 confirm)**

Replace `confirm('Delete this task?')` with ConfirmModal. Replace 5 empty catch blocks with toast.error calls. Replace 2 `.catch(() => {})` with toast.error.

- [ ] **Step 2: Fix workspace detail page (3 catch blocks + 1 confirm)**

Replace `confirm('Remove this member?')` with ConfirmModal. Wire 3 catch blocks to toast.

- [ ] **Step 3: Fix board list page (1 confirm)**

Replace `confirm('Delete this board?')` with ConfirmModal.

- [ ] **Step 4: Fix board detail page (8 catch blocks + 1 confirm)**

Replace `confirm('Delete this board?...')` with ConfirmModal. Wire 8 catch blocks to toast.

- [ ] **Step 5: Fix members-tab.tsx (1 confirm)**

Replace `confirm('Remove N members?')` with ConfirmModal.

- [ ] **Step 6: Fix remaining catch blocks**

Wire toast.error to catch blocks in: `comments-panel.tsx`, `board-file-sidebar.tsx`, `notifications/page.tsx`, `sidebar.tsx`, `security-tab.tsx`, `canvas-surface.tsx`.

- [ ] **Step 7: Verify build**

```bash
cd apps/web && pnpm run build 2>&1 | tail -5
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "fix(toast): wire toast to all mutation failures, replace native confirm()"
```

---

## Task 7: Modal Accessibility

Add `role="dialog"`, `aria-modal`, Escape-to-close, and focus traps to all modals.

**Files:**
- Create: `apps/web/hooks/use-focus-trap.ts` — reusable focus trap hook
- Modify: `apps/web/components/task-modal.tsx` — add dialog semantics + focus trap + Escape
- Modify: `apps/web/components/confirm-modal.tsx` — add role="dialog" + aria (already has Escape)
- Modify: `apps/web/components/ai-ideas-dialog.tsx` — add dialog semantics + focus trap + Escape
- Modify: `apps/web/components/authenticated-layout.tsx` — add dialog semantics to keyboard shortcuts modal

### Focus Trap Hook

Create a `useFocusTrap` hook that:
1. Captures focus on mount (moves to first focusable element)
2. Traps Tab/Shift+Tab within the modal
3. Restores focus to the trigger element on unmount
4. Handles Escape key to close

- [ ] **Step 1: Create use-focus-trap.ts**

```tsx
'use client';
import { useEffect, useRef } from 'react';

export function useFocusTrap(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    const container = containerRef.current;
    if (!container) return;

    // Focus first focusable element
    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first?.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  return containerRef;
}
```

- [ ] **Step 2: Wire into TaskModal**

Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby` to the modal wrapper. Use `useFocusTrap` hook.

- [ ] **Step 3: Wire into ConfirmModal**

Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. Already has Escape handling — replace with `useFocusTrap` for consistency.

- [ ] **Step 4: Wire into AiIdeasDialog**

Add `role="dialog"`, `aria-modal="true"`. Use `useFocusTrap` hook.

- [ ] **Step 5: Wire into keyboard shortcuts modal (authenticated-layout.tsx)**

Add `role="dialog"`, `aria-modal="true"`, Escape-to-close, `useFocusTrap`.

- [ ] **Step 6: Extend focus-visible styling**

Add a global `focus-visible` ring style in globals.css that applies to all interactive elements:
```css
:focus-visible {
  outline: 2px solid var(--color-primary-400);
  outline-offset: 2px;
}
```
This replaces the current approach where only one component has focus-visible styling.

- [ ] **Step 7: Add aria-live region for toasts**

In `contexts/toast-context.tsx`, add `aria-live="polite"` and `aria-atomic="true"` to the toast container so screen readers announce toast messages.

- [ ] **Step 8: Verify build**

```bash
cd apps/web && pnpm run build 2>&1 | tail -5
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "fix(a11y): add focus trap + Escape + role=dialog to all modals, global focus-visible"
```

---

## Task 8: Mobile Navigation via CSS Media Queries

Replace the JS resize listener for mobile bottom tabs with CSS-only responsive behavior.

**Files:**
- Modify: `apps/web/components/authenticated-layout.tsx` — remove isMobile state + resize listener, use CSS `@media` for bottom tabs

- [ ] **Step 1: Replace JS with CSS**

Current approach (JS):
```tsx
const [isMobile, setIsMobile] = useState(false);
useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 768);
  check();
  window.addEventListener('resize', check);
  return () => window.removeEventListener('resize', check);
}, []);
// ...
{isMobile && (<nav className="fixed bottom-0 ...">...</nav>)}
```

New approach (CSS):
```tsx
{/* Bottom tabs - hidden on desktop, shown on mobile via CSS */}
<nav className="fixed bottom-0 left-0 right-0 z-40 hidden max-md:flex border-t ...">
```

Use Tailwind's `max-md:` (max-width: 768rem) variant to show/hide. The sidebar slide-in/out already uses CSS classes (`lg:static`, `lg:translate-x-0`), so this is consistent.

Remove `isMobile` state, `useState` import (if only used for isMobile), and the `useEffect` resize listener.

Also remove `pb-16 lg:pb-0` from main content — use CSS: `pb-16 max-lg:pb-0` (wait, that's backwards). Actually keep the current approach but make it CSS-only:
```tsx
<main className="relative flex min-w-0 flex-1 flex-col overflow-auto pb-16 max-lg:pb-16 lg:pb-0">
```

Actually the current `pb-16 lg:pb-0` IS already CSS-only and correct. The issue is only the `{isMobile && ...}` conditional rendering. Change to:
```tsx
<nav className="fixed bottom-0 left-0 right-0 z-40 flex max-lg:flex lg:hidden border-t ...">
```

- [ ] **Step 2: Remove unused imports**

Remove `useState` import if no longer needed for isMobile. Keep it if `sidebarOpen` still uses it.

- [ ] **Step 3: Verify behavior**

Test: resize browser window — bottom tabs should appear/disappear instantly without flash. No JS resize events.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/authenticated-layout.tsx
git commit -m "fix(mobile): replace JS resize listener with CSS media queries for bottom tabs"
```

---

## Task 9: Breadcrumbs for Nested Contexts

Add real breadcrumbs to replace back-arrows where "back" doesn't capture position. Breadcrumbs show workspace → board → task, giving users spatial awareness.

**Files:**
- Create: `apps/web/components/breadcrumbs.tsx` — reusable breadcrumb component
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/page.tsx` — add breadcrumbs
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/page.tsx` — add breadcrumbs
- Modify: `apps/web/app/workspaces/[workspaceId]/page.tsx` — add breadcrumbs
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/page.tsx` — add breadcrumbs

### Design

Follows DESIGN.md: text-label size (12px), surface-400 for separators, primary-400 for the current (last) segment, surface-500 for parent segments. Separator is `/` character, not an icon. The back-arrow (`<ArrowLeft>`) is removed where breadcrumbs are added — the breadcrumb trail replaces it.

```tsx
// components/breadcrumbs.tsx
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;  // undefined = current page (not linked)
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={12} className="text-surface-600" />}
          {item.href ? (
            <Link href={item.href} className="text-surface-400 hover:text-surface-200 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-surface-100 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 1: Create breadcrumbs.tsx component**

Write the component as specified above.

- [ ] **Step 2: Add breadcrumbs to board detail page**

In `app/workspaces/[workspaceId]/boards/[boardId]/page.tsx`:
- Add `import { Breadcrumbs } from '@/components/breadcrumbs';`
- Replace the `<ArrowLeft>` back link with:
```tsx
<Breadcrumbs items={[
  { label: workspace.name, href: `/workspaces/${workspaceId}` },
  { label: 'Boards', href: `/workspaces/${workspaceId}/boards` },
  { label: board.name },
]} />
```
- Remove the old `<Link href="...boards"><ArrowLeft />...</Link>` element

- [ ] **Step 3: Add breadcrumbs to canvas page**

In `app/workspaces/[workspaceId]/boards/[boardId]/canvas/page.tsx`:
```tsx
<Breadcrumbs items={[
  { label: workspace.name, href: `/workspaces/${workspaceId}` },
  { label: 'Boards', href: `/workspaces/${workspaceId}/boards` },
  { label: board.name, href: `/workspaces/${workspaceId}/boards/${boardId}` },
  { label: 'Canvas' },
]} />
```

- [ ] **Step 4: Add breadcrumbs to workspace detail page**

In `app/workspaces/[workspaceId]/page.tsx`:
```tsx
<Breadcrumbs items={[
  { label: workspace.name },
]} />
```

- [ ] **Step 5: Add breadcrumbs to boards list page**

In `app/workspaces/[workspaceId]/boards/page.tsx`:
```tsx
<Breadcrumbs items={[
  { label: workspace.name, href: `/workspaces/${workspaceId}` },
  { label: 'Boards' },
]} />
```

- [ ] **Step 6: Verify build**

```bash
cd apps/web && pnpm run build 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(nav): add breadcrumb navigation for nested workspace contexts"
```

---

## Task 10: Workspace Switcher

Replace the accordion-style workspace list in the sidebar with a proper workspace switcher — a dropdown that shows the current workspace and lets users switch between workspaces.

**Files:**
- Modify: `apps/web/components/sidebar.tsx` — replace accordion with switcher dropdown

### Design

The current sidebar shows all workspaces in an expandable list (accordion) with lazy-loaded boards under each. The switcher pattern:

1. **Collapsed state (default):** A single row at the top of the workspace section showing the active workspace name + chevron. Clicking opens the dropdown.
2. **Dropdown:** Lists all workspaces. Each shows workspace name + role badge. Clicking switches the active workspace and navigates to its overview.
3. **Boards stay in the accordion below:** The per-workspace board list stays as-is — it's useful. The switcher just replaces the "all workspaces visible at once" pattern with "one active workspace, switch via dropdown."

This keeps the sidebar compact and follows the DESIGN.md principle: "everything needed is within reach, nothing competes with the canvas."

```tsx
// Workspace switcher section in sidebar.tsx
const [switcherOpen, setSwitcherOpen] = useState(false);
const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

// In JSX — replace the workspace list with:
<div className="relative">
  <button
    onClick={() => setSwitcherOpen(!switcherOpen)}
    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-surface-200 hover:bg-surface-800/50"
  >
    <WorkspaceLogo name={activeWorkspace?.name ?? 'Select'} />
    <span className="flex-1 truncate text-left">{activeWorkspace?.name ?? 'Select workspace'}</span>
    <ChevronDown size={14} className={`text-surface-500 transition-transform ${switcherOpen ? 'rotate-180' : ''}`} />
  </button>

  {switcherOpen && (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-surface-800/50 bg-surface-900 p-1 shadow-xl">
      {workspaces.map(ws => (
        <Link
          key={ws.id}
          href={`/workspaces/${ws.id}`}
          onClick={() => setSwitcherOpen(false)}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
            ws.id === activeWorkspaceId
              ? 'bg-surface-800 text-white'
              : 'text-surface-400 hover:bg-surface-800/50 hover:text-surface-200'
          }`}
        >
          <WorkspaceLogo name={ws.name} />
          <span className="flex-1 truncate">{ws.name}</span>
          <span className="text-[10px] uppercase tracking-wider text-surface-600">{ws.role}</span>
        </Link>
      ))}
      <Link
        href="/workspaces"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-surface-400 hover:bg-surface-800/50 hover:text-surface-200"
      >
        <Plus size={14} />
        <span>All workspaces</span>
      </Link>
    </div>
  )}
</div>
```

- [ ] **Step 1: Add activeWorkspaceId state**

Track which workspace is "active" (derived from current URL pathname). Add a `useEffect` that syncs `activeWorkspaceId` with the `[workspaceId]` param in the URL.

- [ ] **Step 2: Replace accordion with switcher dropdown**

Remove the current `expandedWorkspaces` Set and the per-workspace expand/collapse UI. Replace with the switcher dropdown pattern above.

- [ ] **Step 3: Keep board list as secondary nav**

When a workspace is selected, show its boards in a flat list below the switcher (no longer per-workspace accordion — just the active workspace's boards).

- [ ] **Step 4: Close dropdown on outside click**

Add a click-outside handler to close the dropdown when clicking elsewhere in the sidebar.

- [ ] **Step 5: Verify build**

```bash
cd apps/web && pnpm run build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/sidebar.tsx
git commit -m "feat(nav): replace workspace accordion with dropdown switcher"
```

---

## Task 11: Optimize Asset Bloat

Replace raw JPEG backgrounds with Next.js Image and proper sizing.

**Files:**
- Modify: `apps/web/app/auth/login/page.tsx` — replace `<img>` or CSS background with Next.js Image
- Modify: `apps/web/app/dashboard/page.tsx` — same
- Modify: `apps/web/app/calendar/page.tsx` — same
- Create: optimized WebP versions of bg-desktop.jpeg and bg-mobile.jpeg (or use Next.js Image with `priority` + format negotiation)

### Approach

The JPEG backgrounds are used as CSS `background-image` in 3 files. Next.js `<Image>` can't replace CSS backgrounds directly. Options:
1. Convert to `<Image>` as decorative `<img>` with `fill` + `object-cover`
2. Keep as CSS background but optimize the JPEGs (compress to WebP)
3. Use Next.js `Image` with `sizes` prop for responsive loading

Best approach: convert to `<Image>` components with `fill` and `object-cover` for automatic format negotiation (WebP/AVIF) and responsive sizing. Wrap in a positioned container.

- [ ] **Step 1: Optimize JPEG files**

Use sharp or squoosh to convert:
```bash
# If sharp is available:
npx sharp-cli -i public/bg-desktop.jpeg -o public/bg-desktop.webp --format webp --quality 80
npx sharp-cli -i public/bg-mobile.jpeg -o public/bg-mobile.webp --format webp --quality 80
```

If sharp isn't available, compress the existing JPEGs to ~200KB each using any tool, or rely on Next.js Image to serve WebP automatically.

- [ ] **Step 2: Convert login page background**

Replace CSS `background-image: url('/bg-desktop.jpeg')` with:
```tsx
import Image from 'next/image';
// In the container:
<div className="relative">
  <Image src="/bg-desktop.jpeg" alt="" fill className="object-cover" priority />
  {/* content on top */}
</div>
```

- [ ] **Step 3: Convert dashboard page background**

Same pattern.

- [ ] **Step 4: Convert calendar page background**

Same pattern.

- [ ] **Step 5: Verify build + visual check**

```bash
cd apps/web && pnpm run build 2>&1 | tail -5
```

Verify images load, are responsive, and serve in modern formats.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "perf(assets): optimize background JPEGs, use Next.js Image for format negotiation"
```

---

## Task 12: Final Verification and DESIGN.md Update

Update DESIGN.md to reflect all changes made. Run full verification.

**Files:**
- Modify: `DESIGN.md` — add type scale, elevation tiers, spacing conventions as documented reality (not aspiration)

- [ ] **Step 1: Update DESIGN.md typography section**

Add the semantic type scale table showing the mapping from semantic tokens to actual CSS values. Confirm the 6-tier hierarchy matches what's now in the code.

- [ ] **Step 2: Update DESIGN.md elevation section**

Document the 5-tier shadow vocabulary with the actual Tailwind classes used. Confirm the code matches.

- [ ] **Step 3: Update DESIGN.md spacing section**

Document the padding conventions: card=p-4, modal=p-6, compact=p-3, auth=p-6/p-8.

- [ ] **Step 4: Full typecheck**

```bash
cd apps/web && pnpm run build 2>&1 | tail -10
```

- [ ] **Step 5: Full lint**

```bash
cd apps/web && pnpm run lint 2>&1 | tail -5
```

- [ ] **Step 6: Final commit**

```bash
git add DESIGN.md
git commit -m "docs: update DESIGN.md to reflect implemented type scale, elevation, and spacing"
```
