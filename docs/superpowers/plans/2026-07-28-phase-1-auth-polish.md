# Phase 1: Auth Pages Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish all auth pages (login, register, password reset, email verification) with better UX, validation, and responsive layout.

**Architecture:** Pure frontend changes to `apps/web/app/auth/*` pages. No new backend endpoints. No new files needed — all edits are in existing page files.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, lucide-react

## Global Constraints

- All existing Tailwind theme tokens (`surface-*`, `primary-*`) used consistently
- No new npm dependencies
- All form validation messages must match the backend error format (lowercase, no exclamation marks)
- Dark theme only (no light mode in auth pages)

---

### Task 1: Password strength indicator + inline validation

**Files:**
- Modify: `apps/web/app/auth/register/page.tsx`
- Modify: `apps/web/app/auth/reset-password/page.tsx`

- [ ] **Step 1: Add password strength utility**

Add a `getPasswordStrength(password: string): { score: number; label: string; color: string }` function to both pages (or a shared util — keep it inline for now, extract later if needed).

```tsx
function getPasswordStrength(password: string): {
  score: number; // 0-4
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
  return { score, label: labels[score], color: colors[score] };
}
```

- [ ] **Step 2: Add strength bar below password input**

Insert after the password input in both register and reset-password pages:

```tsx
{password && (
  <div className="mt-1.5">
    <div className="flex gap-0.5">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${
            i <= strength.score ? strength.color : 'bg-surface-700'
          }`}
        />
      ))}
    </div>
    <p className="mt-0.5 text-xs" style={{ color: strength.color.replace('bg-', '').replace('-500', '') }}>
      {strength.label}
    </p>
  </div>
)}
```

- [ ] **Step 3: Add inline field validation**

Add validation before submit on register page:
- Email: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)` — show "Invalid email address"
- Password length < 8: "Password must be at least 8 characters"
- Confirm password (reset page): Add confirm field matching

- [ ] **Step 4: Add "Show password" toggle**

On register and reset-password pages, add an eye/eye-off icon button inside the password input wrapper:

```tsx
const [showPassword, setShowPassword] = useState(false);
// ...
<div className="relative">
  <input type={showPassword ? 'text' : 'password'} ... />
  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
  >
    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
  </button>
</div>
```

Add `Eye, EyeOff` to the lucide-react import.

- [ ] **Step 5: Run the app and verify auth pages render correctly**

Run `pnpm dev` and navigate through `/auth/login`, `/auth/register`, `/auth/reset-password?token=test` to verify all changes render without errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/auth/
git commit -m "feat(auth): add password strength indicator, inline validation, show/hide toggle"
```

---

### Task 2: Page transitions and responsive polish

**Files:**
- Modify: `apps/web/app/auth/login/page.tsx`
- Modify: `apps/web/app/auth/register/page.tsx`
- Modify: `apps/web/app/auth/request-verification/page.tsx`
- Modify: `apps/web/app/auth/request-password-reset/page.tsx`
- Modify: `apps/web/app/auth/reset-password/page.tsx`
- Modify: `apps/web/app/auth/verify-email/page.tsx`

- [ ] **Step 1: Add fade-in animation to auth page containers**

Add a CSS keyframe animation by updating the auth page wrappers. Wrap the card content div in each auth page with:

```tsx
<div className="animate-fadeIn">
  {/* existing card content */}
</div>
```

Add to `apps/web/app/globals.css`:

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}
```

Apply `animate-fadeIn` to the card container div on each auth page.

- [ ] **Step 2: Fix auto-focus on email field (login) and name field (register)**

Add `autoFocus` prop to the first input on each auth form:
- Login: email input gets `autoFocus`
- Register: name input gets `autoFocus`
- Request verification: email input gets `autoFocus`
- Request password reset: email input gets `autoFocus`
- Reset password: password input gets `autoFocus`

- [ ] **Step 3: Refactor button loading states**

Replace text-based loading ("Signing in...", "Creating account...") with spinner + text pattern consistently across all auth pages:

```tsx
<button disabled={submitting} ...>
  {submitting ? (
    <span className="flex items-center gap-2">
      <Loader2 size={14} className="animate-spin" />
      Signing in
    </span>
  ) : (
    'Sign in'
  )}
</button>
```

Add `Loader2` to imports where missing.

- [ ] **Step 4: Responsive audit**

Check each auth page at 320px width. Ensure:
- Card padding is `p-6` on mobile, `p-8` on sm+
- Form inputs are full width
- No horizontal overflow
- All text is readable (no truncation on important content)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/auth/ apps/web/app/globals.css
git commit -m "feat(auth): add page transitions, auto-focus, spinner states, responsive polish"
```

---

### Task 3: Password reset confirm field

**Files:**
- Modify: `apps/web/app/auth/reset-password/page.tsx`

- [ ] **Step 1: Add confirm password match validation**

The reset page already has a confirm input but no client-side match check before submit. Add:

```tsx
if (password !== confirm) {
  setError('Passwords do not match');
  return;
}
```

- [ ] **Step 2: Visual confirmation indicator**

Add a small check/x icon next to the confirm field showing whether passwords match:

```tsx
{confirm && (
  <span className="absolute right-3 top-1/2 -translate-y-1/2">
    {password === confirm ? (
      <Check size={14} className="text-emerald-500" />
    ) : (
      <X size={14} className="text-red-500" />
    )}
  </span>
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/auth/reset-password/page.tsx
git commit -m "feat(auth): add confirm password match validation with visual indicator"
```
