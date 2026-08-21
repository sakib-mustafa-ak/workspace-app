# Particle Field Background Design

## Overview
Replace plain solid backgrounds with an animated particle field — tiny floating dots that drift gently. Suitable for a professional work environment: subtle, non-distracting, ambient.

## Design Decisions

### Visual Style
- 30-50 tiny dots (1-2px) with very low opacity (20-40%)
- Colors: existing `primary-400` and `surface-400` tokens
- Slow drift animation (20-40s cycle) — barely perceptible
- Fixed position behind content, `pointer-events-none`

### Technical Approach
- Pure CSS `@keyframes` — no JavaScript, no canvas
- Reusable `ParticleField` React component
- Respects `prefers-reduced-motion` (disables animation)
- Uses CSS custom properties for dot count and colors

### Scope
- Applied to: login, dashboard, calendar, and all main content areas
- Each page wraps its content with `<ParticleField>` component

## Files to Create/Modify
- `apps/web/components/particle-field.tsx` — new component
- `apps/web/app/globals.css` — add particle keyframes
- `apps/web/app/auth/login/page.tsx` — wrap with ParticleField
- `apps/web/app/dashboard/page.tsx` — wrap with ParticleField
- `apps/web/app/calendar/page.tsx` — wrap with ParticleField
