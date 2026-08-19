# Charcoal & Lavender Rebrand + Login Page Redesign

**Date**: 2026-08-19
**Status**: Approved (with text-contrast requirement)

## 1. Goal

Rebrand the whole app from "instrument blue on slate" to **charcoal #2E2E2E as the core UI color** and **soft lavender gray #D6CFE1 as the accent**, and redesign the `/auth/login` page: animated, with a project description and Facebook-style saved-profile banners.

## 2. Hard Requirements

1. **Text contrast**: All body text must remain easily readable. Do NOT lighten text colors beyond what keeps strong contrast on their backgrounds (WCAG AA minimum; effectively keep text near-white in dark theme and near-black in light theme). Lavender is an accent, not a text color.
2. The color change applies to the **whole app** (boards, canvas, sidebar, toasts follow via CSS vars).
3. No commit until the user explicitly asks.

## 3. Color System (`apps/web/app/globals.css`)

### Dark theme
- Backgrounds: near-black charcoal ramp — `surface-950: #121212`, `surface-900: #1A1A1A`, `surface-800: #242424`, `surface-700: #2E2E2E` (the brand charcoal), `surface-600: #3A3A3A`, `surface-500: #4A4A4A`.
- Text ramp (kept high-contrast): `surface-100: #F4F1F8` (primary text, near-white with a lavender hint), `surface-200: #E6E1EC`, `surface-300: #D6CFE1` (the brand lavender — allowed as secondary text because it is still light), `surface-400: #9B93A8` (muted text — maximum allowed lightness), `surface-500: #7A7385`.
- `primary` ramp = lavender family: **dark theme** — `primary-300: #E8E3F0` (link hover), `primary-400: #D6CFE1` (links, active icons — light-on-dark, high contrast), `primary-500: #B9B0C8` (focus seams, hover borders), `primary-600: #2E2E2E` (button bg = charcoal core, text `#F4F1F8`), `primary-700: #3A3A3A` (button hover). **Light theme** — `primary-600: #2E2E2E` (button bg, white text), `primary-400: #6E637E` (links — darker lavender, readable on light bg), `primary-500: #4A4454` (focus seams).
- `--color-primary-50..200`: reserved for light-theme tints.

### Light theme
- Backgrounds: lavender-tinted whites — `surface-50: #F8F6FB`, `surface-100: #F0EDF6`, `surface-200: #E4E0EC`, `surface-300: #D6CFE1`.
- Text: charcoal ramp — `surface-700: #3A3A3A`, `surface-800: #2E2E2E`, `surface-900: #242424`, `surface-950: #1A1A1A` (headings/body near-black).
- Buttons: charcoal `#2E2E2E` with `#F4F1F8` text (high contrast on light).
- Keep the existing `.light` amber remap for the verification banner (adjust if needed for the new surfaces).

### Canvas
- `themeColors()` in the canvas renderer reads CSS vars → follows automatically. Verify grid/accent contrast after the swap.

## 4. Login Page Redesign (`apps/web/app/auth/login/page.tsx`)

- **Split layout** (responsive): left brand panel on `lg+` screens — logo mark, "Workspace OS", short description ("A collaborative workspace — teams, boards, tasks, canvas, and notifications in one place."), subtle animated gradient orbs; right column = the login card (existing calm-seam inputs kept).
- **Animation**: staggered fade-up entrance (card elements), drifting gradient orbs (CSS keyframes), breathing logo mark, existing hover micro-interactions.
- Theme toggle (existing Dark/Light segmented control) stays in the card header.

## 5. Saved-Profile Banners

- New `apps/web/lib/recent-profiles.ts`: `recentProfiles` in localStorage — `{ id, displayName, email, lastLoginAt }[]`, max 4, deduped by id, most recent first.
- Updated on every successful login/register (hook into `lib/auth.ts` login/register or the auth context).
- Rendered above the login form: row of avatar chips (initial + name), hover shows an × to remove.
- **Click**: if profile is the current session user and an `accessToken` exists → `getMe()` → valid → `/dashboard`; otherwise prefill email + focus password.
- On click failure (expired/401): fall back to prefill flow.

## 6. Verification

- `pnpm --filter web exec tsc --noEmit`
- `pnpm run lint` (web `--max-warnings 0`)
- Browser test over `http://103.176.2.252:3000`: register → dashboard → login page shows banner for the saved profile → click-through works.
- Visual check: text contrast on all pages, canvas visibility.

## 7. Files

- `apps/web/app/globals.css` — palette rewrite
- `apps/web/app/auth/login/page.tsx` — layout + animation + banners
- `apps/web/lib/recent-profiles.ts` — new
- `apps/web/lib/auth.ts` — record profile on login/register
- `DESIGN.md` — update color section
- `apps/web/app/workspaces/.../canvas` — verify only