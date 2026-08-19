# Charcoal & Lavender Rebrand + Login Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the whole app to charcoal #2E2E2E + lavender gray #D6CFE1, redesign the login page with animation, a project description, and Facebook-style saved-profile banners.

**Architecture:** Pure CSS-variable swap in `globals.css` recolors the entire app (all components read tokens). A new `lib/recent-profiles.ts` module persists recent logins in localStorage; the login page renders profile chips and handles click-through (valid session → dashboard, else prefill email + focus password).

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS 4 (CSS-variable tokens), React 19, TypeScript.

## Global Constraints

- **Text contrast is a hard requirement:** body text must remain near-white in dark theme and near-black in light theme. Lavender is an accent, never a dim text color. Use exactly the hex values from the spec.
- **Web runs a production build** (`next start`) because dev-mode HMR breaks over the public IP. After any web change: `pnpm --filter web build` + restart the `next start` process, then verify over `http://103.176.2.252:3000`.
- **Do NOT commit automatically.** The user requires being asked before every commit. End each task with a "ask user to commit" step instead of committing.
- No unit-test framework exists in `apps/web` (only `apps/api` has jest). Verification = `tsc --noEmit`, `pnpm run lint`, and Playwright browser checks over the public IP.
- Commit author identity: `platinum-diode <bijoii619@gmail.com>` via `git -c user.name="platinum-diode" -c user.email="bijoii619@gmail.com" commit ...`

---

### Task 1: Rewrite the color palettes in globals.css

**Files:**
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Produces: new `--color-primary-*` and `--color-surface-*` token values (dark theme block and `.light` block). All component code keeps using the same class names — nothing else changes.

- [ ] **Step 1: Read the current `globals.css`** to find both palette blocks (the default `@theme` dark palette at the top and the `.light` override block) plus the `.light` amber remap.

- [ ] **Step 2: Replace the dark-theme primary ramp** (currently blues #eff6ff → #1e3a8a) with:
```css
--color-primary-50:  #f8f6fb;
--color-primary-100: #f0edf6;
--color-primary-200: #e4e0ec;
--color-primary-300: #e8e3f0;
--color-primary-400: #d6cfe1;
--color-primary-500: #b9b0c8;
--color-primary-600: #2e2e2e;
--color-primary-700: #3a3a3a;
--color-primary-800: #242424;
--color-primary-900: #1a1a1a;
```

- [ ] **Step 3: Replace the dark-theme surface ramp** (currently slate #f8fafc → #020617) with:
```css
--color-surface-50:  #f8f6fb;
--color-surface-100: #f4f1f8;
--color-surface-200: #e6e1ec;
--color-surface-300: #d6cfe1;
--color-surface-400: #9b93a8;
--color-surface-500: #7a7385;
--color-surface-600: #4a4a4a;
--color-surface-700: #2e2e2e;
--color-surface-800: #242424;
--color-surface-900: #1a1a1a;
--color-surface-950: #121212;
```

- [ ] **Step 4: Update the `.light` override block** to lavender-tinted whites + charcoal text (surface ramp) and dark lavender accents:
```css
.light {
  color-scheme: light;
  --color-surface-50:  #ffffff;
  --color-surface-100: #f8f6fb;
  --color-surface-200: #f0edf6;
  --color-surface-300: #e4e0ec;
  --color-surface-400: #c9c2d4;
  --color-surface-500: #9b93a8;
  --color-surface-600: #6b6573;
  --color-surface-700: #3a3a3a;
  --color-surface-800: #2e2e2e;
  --color-surface-900: #242424;
  --color-surface-950: #1a1a1a;
  --color-primary-300: #8a7fa0;
  --color-primary-400: #6e637e;
  --color-primary-500: #4a4454;
  --color-primary-600: #2e2e2e;
  --color-primary-700: #242424;
  --color-primary-800: #1a1a1a;
  --color-primary-900: #121212;
}
```
Keep the existing `.light` amber remap (verify the amber values still read well on the new light surfaces).

- [ ] **Step 5: Verify** — `pnpm run lint` passes. Rebuild + restart web, then visually check over the public IP (dashboard, board, canvas grid, toasts) and confirm body text is high-contrast in both themes.

- [ ] **Step 6: Ask the user to commit** (do not commit automatically).

---

### Task 2: Recent-profiles persistence module

**Files:**
- Create: `apps/web/lib/recent-profiles.ts`
- Modify: `apps/web/lib/auth.ts` (call `recordRecentProfile` in `login` and `register`)

**Interfaces:**
- Produces (consumed by Task 3):
  - `type RecentProfile = { id: string; displayName: string; email: string; lastLoginAt: string }`
  - `getRecentProfiles(): RecentProfile[]` — newest first, max 4, safe on SSR
  - `recordRecentProfile(p: { id: string; displayName: string; email: string }): void`
  - `removeRecentProfile(id: string): void`

- [ ] **Step 1: Create `apps/web/lib/recent-profiles.ts`**
```ts
export type RecentProfile = {
  id: string;
  displayName: string;
  email: string;
  lastLoginAt: string;
};

const KEY = 'recentProfiles';
const MAX = 4;

export function getRecentProfiles(): RecentProfile[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p): p is RecentProfile => p && typeof p.id === 'string' && typeof p.email === 'string')
      .sort((a, b) => (a.lastLoginAt < b.lastLoginAt ? 1 : -1))
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function recordRecentProfile(p: {
  id: string;
  displayName: string;
  email: string;
}): void {
  if (typeof window === 'undefined') return;
  const next: RecentProfile[] = [
    { ...p, lastLoginAt: new Date().toISOString() },
    ...getRecentProfiles().filter((x) => x.id !== p.id),
  ].slice(0, MAX);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function removeRecentProfile(id: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    KEY,
    JSON.stringify(getRecentProfiles().filter((p) => p.id !== id)),
  );
}
```

- [ ] **Step 2: Hook into `apps/web/lib/auth.ts`** — in `login()` after `localStorage.setItem('refreshToken', ...)` add:
```ts
recordRecentProfile({ id: data.user.id, displayName: data.user.displayName ?? '', email: data.user.email });
```
Same in `register()`. Import `recordRecentProfile` from `./recent-profiles`.

- [ ] **Step 3: Verify** — `pnpm --filter web exec tsc --noEmit` and `pnpm run lint` pass.

- [ ] **Step 4: Ask the user to commit.**

---

### Task 3: Login page redesign with banners

**Files:**
- Modify: `apps/web/app/auth/login/page.tsx`
- Modify: `apps/web/app/globals.css` (add keyframes: `fadeUp`, `drift`, `breathe`)

**Interfaces:**
- Consumes: `getRecentProfiles`, `removeRecentProfile` from Task 2; `getStoredUser`, `clearSession`, `getMe` from `@/lib/auth`; `useAuth` from `@/contexts/auth-context`.
- Produces: redesigned `/auth/login` with left brand panel (project description), staggered entrance animation, and profile banner chips.

- [ ] **Step 1: Add animation keyframes to `globals.css`**
```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes drift {
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(30px, -20px) scale(1.08); }
  100% { transform: translate(0, 0) scale(1); }
}
@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.05); opacity: 1; }
}
.animate-fadeUp { animation: fadeUp 0.5s ease-out both; }
.animate-drift { animation: drift 12s ease-in-out infinite; }
.animate-breathe { animation: breathe 3s ease-in-out infinite; }
```

- [ ] **Step 2: Rewrite `apps/web/app/auth/login/page.tsx`** — split layout:
  - Left panel (`hidden lg:flex`, flex-1): animated orbs (`bg-primary-400/10` blurred circles with `animate-drift`), logo mark (`animate-breathe`), "Workspace OS" title, short description: "A collaborative workspace — teams, boards, tasks, canvas, and notifications in one place."
  - Right column (`max-w-md`): keep the theme toggle segmented control, then profile banners row, then the existing login card.
  - Profile banners: `const [profiles, setProfiles] = useState(getRecentProfiles())`; render chips only when `profiles.length > 0`:
```tsx
<div className="mb-4 flex flex-wrap items-center gap-2">
  {profiles.map((p) => (
    <button
      key={p.id}
      type="button"
      onClick={() => handleProfileClick(p)}
      title={p.email}
      className="group relative flex items-center gap-2 rounded-full border border-surface-700/60 bg-surface-800/40 py-1 pl-1 pr-3 text-sm transition-colors hover:border-primary-500/50"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-surface-100">
        {(p.displayName || p.email)[0]?.toUpperCase()}
      </span>
      <span className="text-surface-200">{p.displayName || p.email}</span>
      <span
        role="button"
        aria-label={`Remove ${p.displayName}`}
        onClick={(e) => { e.stopPropagation(); removeRecentProfile(p.id); setProfiles(getRecentProfiles()); }}
        className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-surface-600 text-[10px] text-surface-100 group-hover:flex"
      >
        ×
      </span>
    </button>
  ))}
</div>
```
  - `handleProfileClick`:
```ts
async function handleProfileClick(p: RecentProfile) {
  const token = localStorage.getItem('accessToken');
  const stored = getStoredUser();
  if (token && stored?.id === p.id) {
    try {
      await getMe();
      router.push('/dashboard');
      return;
    } catch {
      clearSession();
    }
  }
  setEmail(p.email);
  passwordRef.current?.focus();
}
```
  - Add `emailRef`/`passwordRef` to the inputs; entrance stagger via `animate-fadeUp` + inline `style={{ animationDelay: '0.1s' }}` (0.1s/0.2s/0.3s on logo/card/banners).
  - Import `useRouter` from `next/navigation`; `RecentProfile`, `getRecentProfiles`, `removeRecentProfile` from `@/lib/recent-profiles`; `getStoredUser`, `clearSession`, `getMe` from `@/lib/auth`.

- [ ] **Step 3: Verify** — `pnpm --filter web exec tsc --noEmit`, `pnpm run lint`.

- [ ] **Step 4: Rebuild + restart web** (`pnpm --filter web build`, restart `next start`), then browser-verify over `http://103.176.2.252:3000`:
  1. Register a fresh user → lands on `/dashboard`.
  2. Log out → login page shows a profile chip with the saved user.
  3. Click the chip → pre-fills email + focuses password (session cleared, so no auto-login).
  4. Check contrast: body text readable in dark and light themes; canvas page still visible.

- [ ] **Step 5: Ask the user to commit.**

---

### Task 4: Update DESIGN.md color section

**Files:**
- Modify: `DESIGN.md`

- [ ] **Step 1: Read `DESIGN.md`**, find the color/palette section (currently "instrument blue" + slate).
- [ ] **Step 2: Replace with:** brand = charcoal `#2E2E2E` (core UI color: surfaces, buttons) + soft lavender gray `#D6CFE1` (accent: links, active states, focus seams). Text rule: keep body text high-contrast (near-white on dark, near-black on light); lavender is accent only, never dim body text.
- [ ] **Step 3: Ask the user to commit.**

---

### Task 5: Full verification pass

**Files:**
- None (verification only)

- [ ] **Step 1: Run `pnpm run lint`** — expect clean (web has `--max-warnings 0`).
- [ ] **Step 2: Run `pnpm --filter web exec tsc --noEmit`** — expect clean.
- [ ] **Step 3: Browser test over `http://103.176.2.252:3000`** (Playwright, headless chromium from `/tmp/opencode`): register → dashboard → logout → banner chip appears → click chip → email prefilled + password focused. Screenshot both themes.
- [ ] **Step 4: Confirm `http://103.176.2.252:4000/api/v1/health` still 200** and the API untouched.
- [ ] **Step 5: Ask the user to commit anything remaining.**