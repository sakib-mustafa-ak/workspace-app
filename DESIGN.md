---
name: Workspace OS — The Infinite Desk
description: Dark-first collaborative workspace. Deep charcoal surfaces, calm lavender-gray accent, flat at rest with quiet glow on interaction.
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
typography:
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  button:
    fontSize: "14px"
    fontWeight: 500
  label:
    fontSize: "12px"
    fontWeight: 400
  section-label:
    fontSize: "10px"
    fontWeight: 500
    letterSpacing: "0.05em"
    textTransform: "uppercase"
  title:
    fontSize: "16px"
    fontWeight: 600
  headline:
    fontSize: "20px"
    fontWeight: 600
  display:
    fontSize: "24px"
    fontWeight: 700
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-bright}"
  button-ghost:
    textColor: "{colors.text-muted}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
  nav-item:
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "{colors.surface-raised}"
    textColor: "#ffffff"
  card:
    backgroundColor: "{colors.surface-panel}"
    rounded: "{rounded.lg}"
  avatar:
    backgroundColor: "{colors.surface-edge}"
    rounded: "{rounded.full}"
    size: "28px"
  badge:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    typography: "{typography.section-label}"
---

# Design System: Workspace OS — The Infinite Desk

## Overview

**Creative North Star: "The Infinite Desk"**

The canvas is the product. Workspace OS is a real-time collaboration surface, and the UI behaves like a well-kept desk in a dark studio: everything needed is within reach, the lighting is dim so the work stands out, and nothing on the desk competes with the paper you're drawing on. The interface is a quiet instrument tuned for focus — dark charcoal surfaces recede, the lavender-gray accent marks only the active moment, and depth appears when you reach for something, not at rest.

The aesthetic is calm and precise: deep charcoal panels layered tonally, hairline borders at the seams, and a single soft lavender-gray that reads as signal rather than personality. Density is compact but airy — 12px body text for meta, 14px for work, generous 8px radii on controls, 12–16px on containers. Motion is quick and utilitarian (150–350ms ease-out); nothing bounces, everything settles. This is an instrument, not a toy.

Confirmed visual rejections: no candy/neon dark mode, no multi-hue gradients, no glassmorphism on every surface (frosted blur is reserved for hero/auth panels), no playful animation.

**Key Characteristics:**
- Dark-first charcoal surfaces (surface-950 page, surface-900 panels, surface-800 raised) with hairline borders
- Single lavender-gray accent (primary-400/300) for actions, focus, active state, and the logo mark
- Flat at rest, quiet glow on interaction — shadows and glows are responses, not decorations
- Tonal layering as the default depth mechanism; shadows only for float and hover
- 8px control radius, 12–16px container radius, full pills for avatars/badges
- Geist sans throughout; 10px uppercase tracking-wider labels for section headers
- Quick utilitarian motion: 0.2–0.35s ease-out mounts, infinite shimmer for skeletons, border glow for scanning states

## Colors

A single soft lavender-gray accent over a charcoal neutral ramp. Lavender is used sparingly — it is signal, not fill. Body text keeps high contrast in both themes (near-white on dark, near-black on light); lavender is never a dim text color.

### Primary
- **Brand Charcoal** (#2e2e2e, primary-600): The action color. Primary buttons, active pill backgrounds, focus accents. In light theme it doubles as the core text color.
- **Lavender Gray** (#d6cfe1, primary-400): The accent. Links, active nav icons, focus seams, avatar initials on dark.
- **Soft Lavender** (#b9b0c8, primary-500): Hover states, gradient starts, glow shadows.
- **Deep Charcoal** (#242424 / #1a1a1a, primary-800/900): Pressed and deep states.
- **Dusk Lavender** (#6e637e, light-theme primary-400): Links and accents on light surfaces (5.6:1 on white).

### Neutral
- **Deep Charcoal** (#121212, surface-950): Page background, input fill. The desk itself.
- **Charcoal Panel** (#1a1a1a, surface-900): Cards, sidebar gradient base, dropdown surfaces.
- **Raised Charcoal** (#242424, surface-800): Active nav items, hover fills, input borders, panel seams.
- **Edge Charcoal** (#2e2e2e, surface-700): Stronger borders, ghost button strokes, workspace avatar chips.
- **Snow** (#f4f1f8, surface-100): Primary text on dark.
- **Lavender Mist** (#9b93a8, surface-400): Muted text — meta, inactive nav, placeholders.
- **Steel Lavender** (#7a7385, surface-500): Faint text, section labels, icon strokes at rest.
- Light theme surfaces are lavender-tinted whites (surface-950 #ffffff → surface-800 #2e2e2e) with charcoal text for contrast.
- **Signal Red** (#ef4444 / #f87171): Destructive actions and unread badges; 10% tint (red-500/10) for danger chips.
- **Success Green** (#34d399): Success states.
- **Amber Alert** (#fbbf24): Warnings and pending states.

### Named Rules
**The Signal Rule.** Lavender is reserved for the active moment: actions, focus, selection, and the logo. Resting surfaces are charcoal only — a screen with lavender everywhere has lost its signal.

## Typography

**Display Font:** Geist (local woff, `--font-geist-sans`), with ui-sans-serif / system-ui fallback
**Body Font:** Geist (same family — single-family system)
**Label/Mono Font:** none distinct

**Character:** A single geometric-humanist sans carries the whole system — precise, slightly technical, unpretentious. No display pairing, no serif flourishes; hierarchy comes from weight and scale, not from a second voice.

### Hierarchy
- **Display** (700, 24px, 1.2): Page-level headings (dashboard title, auth screens).
- **Headline** (600, 20px, 1.3): Section titles on dashboards and forms.
- **Title** (600, 16px, 1.4): Card titles, entity names.
- **Body** (400, 14px, 1.5): The work — lists, rows, buttons, nav items.
- **Label** (400, 12px, 1.4): Inputs, meta lines, file metadata.
- **Section Label** (500, 10px, +0.05em tracking, uppercase): "Workspaces", "Recent" — sidebar group headers and eyebrow labels.

### Named Rules
**The Compact Rule.** Work text is 12–14px. 16px+ is reserved for titles and headings — the desk stays dense so the canvas gets the space.

## Layout

Shell is a fixed 240px sidebar (w-60) with a hairline right border, plus a 56px header strip. Content flows in a responsive 4px-unit rhythm: 12–16px paddings inside cards, 16–24px gaps between cards, 24px+ page padding. Density is compact by design: nav rows are 8px vertical padding at 14px text, lists use 12px rows, meta at 12px. Sidebar stacks — search, primary nav, workspace list, then the user footer — with 12px padding and 4px item gaps. Cards group in responsive grids (gap 16–24px) that collapse to a single column under ~768px. The sidebar collapses to icons-only or a drawer below the mobile breakpoint.

## Elevation & Depth

Hybrid, tonal-first: depth at rest comes from stacking charcoal tones (page 950 → panel 900 → raised 800), not shadows. Shadows appear only as response — hover glow, float, or focus. Frosted blur (backdrop-blur-xl) appears only on hero/auth glass panels, never on working cards.

### Shadow Vocabulary
- **Resting seam** (`border-surface-800`, 1px): Default card and panel separation. No shadow at rest.
- **Nav active** (`0 1px 2px 0 rgb(0 0 0 / 0.05)`, shadow-sm): The single selected nav row; light tonal lift, not a float.
- **Hover glow** (`0 10px 15px -3px rgb(46 46 46 / 0.25)`, shadow-lg + shadow-primary-600/25): Primary buttons and interactive accents on hover — charcoal-tinted glow marks reachability.
- **Float** (`0 20px 25px -5px rgb(0 0 0 / 0.1)`, shadow-xl): Dropdowns, search results, command surfaces — anything that lifts above the desk.
- **Glass depth** (`0 25px 50px -12px rgb(0 0 0 / 0.25)`, shadow-2xl): Auth/hero glass panels.

### Named Rules
**The Quiet-Reactive Rule.** Surfaces are flat at rest. Shadows and glows are state responses — they appear on hover, focus, and lift, and they disappear when the moment passes. If a resting card needs depth, layer a tone, not a shadow.

## Shapes

Controls and inputs use the 8px corner (rounded-lg) as the default; containers step up to 12px (rounded-xl) for cards and 16px (rounded-2xl) for hero/glass panels. Avatars, badges, and notification counters are full pills (rounded-full). Seams are 1px borders in charcoal tones (surface-800 subtle, surface-700 stronger), with 50% alpha borders on glass. No clipping or irregular silhouettes. The one distinctive geometry is the logo mark: a 28px square with 6px corners carrying a primary-500→primary-700 gradient and a lavender-tinted shadow.

## Components

### Buttons
- **Shape:** 8px corners (rounded-lg), 8px vertical / 16px horizontal padding, 14px medium text.
- **Primary:** bg primary-600, white text. Hover: bg primary-500 + charcoal glow (shadow-lg shadow-primary-600/25). Disabled: 50% opacity. The only component that glows on hover — the desk's "reachable" signal.
- **Ghost:** transparent, 1px edge-charcoal border, mist text. Hover: text shifts to white; no fill until pressed.
- **Danger:** signal-red text on a red-500/10 tint with red-500/20 border for destructive chips; solid red-500 for irreversible actions.

### Chips
- **Style:** full pill (rounded-full), 10px bold white text, px-1.5, ~20px height.
- **State:** unread counters are solid signal-red; workspace initials are 6px-corner squares with charcoal-700 fill and mist text; status chips use tinted backgrounds (red-500/10, primary-600/10) with matching text (red-400, primary-300).

### Cards / Containers
- **Corner Style:** 12px (rounded-xl) standard; 16px (rounded-2xl) for hero/auth glass.
- **Background:** charcoal panel (surface-900) solid or gradient (from-surface-900 to-surface-900/60).
- **Shadow Strategy:** none at rest — hairline border-surface-800/50 seam only; shadow-lg on hover for interactive cards.
- **Border:** 1px border-surface-800 (or /50 on glass).
- **Internal Padding:** 16px standard, 24px for hero panels.

### Inputs / Fields
- **Style:** 1px surface-800 stroke, deep-charcoal fill (surface-950), 8px corners, 12px text, steel placeholder.
- **Focus:** the stroke shifts to primary-500/50 — a calm lavender seam, no ring glow, no background change.
- **Error / Disabled:** disabled at 50% opacity; error messages in signal-red text with red-500/20 stroke.

### Navigation
- **Style:** 8px-corner rows, 8px vertical / 12px horizontal padding, 14px text, mist at rest.
- **Default:** steel/mist text; hover: half-strength raised fill (surface-800/50) with mist-bright text.
- **Active:** raised-charcoal fill (surface-800), white text, shadow-sm, icon shifts to soft lavender. The active row is the only lavender-accented nav element.
- **Mobile:** collapses to icon rail or drawer below the breakpoint; search is a first-class slot in the sidebar header, not a separate page.

### Signature Component: The Glass Panel
The hero/auth surface: 16px corners, 1px border-surface-800/50, gradient from-surface-900 to-surface-900/60, backdrop-blur-xl, shadow-2xl, with two decorative primary-tinted blobs (primary-600/10, primary-500/5) drifting behind. Frosted and layered — it reads as a window onto the desk, the one place blur is allowed.

## Do's and Don'ts

### Do:
- **Do** start every page from the deep-charcoal backdrop (surface-950) and build hierarchy with tonal layering (900 → 800).
- **Do** reserve lavender for actions, focus strokes, active rows, and the logo mark — and use primary-600 as the default action fill.
- **Do** use 8px corners on controls, 12px on cards, 16px on hero panels, and full pills for badges and avatars.
- **Do** use 10px uppercase tracking-wider steel text for section headers and 12px mist for meta.
- **Do** keep resting surfaces flat — reach for the hover glow (charcoal-tinted) only on interactive elements.
- **Do** keep motion between 150–350ms with ease-out; use shimmer (1.5s infinite) for skeletons and borderGlow for scanning states.
- **Do** treat the glass panel (gradient + blur + primary blobs) as an auth/hero-only pattern.

### Don't:
- **Don't** add shadows to resting cards — layer a tone instead.
- **Don't** use lavender as a text color for body copy; text accents stay at primary-300/400 and only for icons or emphasis.
- **Don't** introduce a second accent hue, purple gradients, or neon — the system is lavender over charcoal.
- **Don't** blur working cards; backdrop blur belongs to the hero glass only.
- **Don't** exceed 16px for content text — hierarchy beyond that belongs to titles and headings.
- **Don't** add bouncy or elastic easing; motion settles, it never springs.
