# Frontend Polish & Feature Expansion

**Date:** 2026-07-28
**Status:** Draft
**Owner:** Engineering

## Overview

Comprehensive frontend improvement across all 15 pages of the Workspace OS web app. Each phase polishes the existing UI AND wires up backend features that were built but never surfaced in the frontend. Some phases also add new backend endpoints where the requested feature has no API support yet.

---

## Phase 1: Auth Pages

**Files:** `apps/web/app/auth/*`

### Polish
- Password strength indicator (weak/medium/strong) on register and reset password forms, computed client-side from length, variety, common patterns
- Inline field-level validation (email format, password length, confirm match) before submit
- Smooth fade-in page transitions between auth routes using CSS `@keyframes`
- Button loading state — spinner icon replaces "Signing in…" text
- Auto-focus email field on login, name field on register
- "Show password" toggle icon (eye/eye-off) on register and reset pages
- Responsive adjustments — test at 320px+, reduce padding and font sizes proportionally

### Backend features wired
None — all auth endpoints are already connected.

---

## Phase 2: Dashboard + Sidebar

**Files:** `apps/web/app/dashboard/*`, `apps/web/components/sidebar.tsx`, `apps/web/components/authenticated-layout.tsx`

### Sidebar

| Feature | Description |
|---------|-------------|
| **Search bar** | Text input at sidebar top. Calls `GET /api/v1/search?q=` on enter/300ms debounce. Results shown in a floating panel (boards + workspaces) with click-to-navigate. |
| **Notification badge** | Bell icon shows unread count from `GET /api/v1/notifications/unread/count`. Polled every 30s. Badge uses pulse animation on new count. |
| **Workspace switcher** | Section listing all workspaces user belongs to. Shows workspace initial + name. Click navigates to workspace. Active workspace highlighted. Pulled from `GET /api/v1/workspaces`. |
| **Theme toggle** | Sun/moon icon in sidebar footer. Cycles dark → light → system. Persisted in `localStorage`. Applies class to `<html>` and updates Tailwind `@theme` accordingly. |
| **Collapse button** | Toggle sidebar between full (w-60) and icon-only (w-16) on desktop. Saved in localStorage. |
| **User area** | Simplified — avatar initial circle, name, email. Dropdown with "Settings" and "Sign out". |

### Dashboard

| Feature | Description |
|---------|-------------|
| **Richer workspace cards** | Show member count (`GET /workspaces/:id/members` length), board count (from board list length), user's role badge. |
| **Recent activity** | Last 5 visited boards stored in `localStorage`. Show as horizontal scrollable list. |
| **Quick-create inline** | Name + auto-generated slug (lowercase, hyphens) in one form. User can override slug. |
| **Accept invitations banner** | Check for pending invitations on page load (`GET /workspaces/:id/invitations`?). Show banner with "Accept" / "Decline". |
| **Quick-create board** | Button to create board without navigating to workspace — pick workspace from dropdown, enter name. |
| **Skeleton shimmer** | Replace current pulse blocks with shimmer animation (animated gradient) matching card dimensions. |
| **Empty state** | Better illustration + CTA button for no workspaces. |

---

## Phase 3: Workspace Detail

**Files:** `apps/web/app/workspaces/[workspaceId]/*`

### New page: `/workspaces/[workspaceId]/boards`
Full boards list page:
- Grid of board cards with avatar initial, name, description, task count, member count
- Create board from this page
- Search boards by name
- Archive/unarchive and delete per board
- Empty state

### New page: `/invitations/accept`
- Route reads `selector` and `verifier` from query params
- Calls `POST /api/v1/workspaces/invitations/accept`
- Shows workspace name on success, redirects to workspace
- Error state for invalid/expired tokens

### Workspace tabs

**Overview tab:**
- Analytics card: board count, member count, task count (aggregated from loaded data)
- Recent activity feed (uses audit log — see below)
- Quick action buttons (create board, invite members)

**Boards tab:**
- Board grid with search/filter
- Create board inline

**Members tab:**
- List with avatar, name, email, role badge (Admin=red, Member=blue, Viewer=gray)
- Role change dropdown with confirmation modal
- Bulk operations: checkbox selection, batch role change, batch remove
- Remove member with confirmation modal
- Invite member form with email validation

**Invitations tab:**
- List with email, role, status badge, expiry, invited by, created date
- Revoke with confirmation
- Copy invitation link button

**Settings tab:**
- Name, slug, description editing
- Archive/unarchive
- **Transfer ownership** dropdown (new backend endpoint: `POST /workspaces/:id/transfer { newOwnerId }`)
- Delete with confirmation modal

**Activity tab:**
- **New backend module:** Audit log
  - New database table: `audit_events` (id, workspaceId, userId, action, resourceType, resourceId, metadata JSON, createdAt)
  - New endpoints: `GET /api/v1/workspaces/:id/activity` (paginated), `POST /api/v1/events` (internal)
  - Frontend: timeline view with icon per action type, user avatar, timestamp, resource link

### New backend endpoints needed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /workspaces/:id/transfer` | POST | Transfer workspace ownership |
| `GET /workspaces/:id/activity` | GET | Paginated audit log |
| `POST /boards/export` | POST | Export boards as JSON |
| `POST /boards/import` | POST | Import boards from JSON |

---

## Phase 4: Board / Kanban

**Files:** `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/*`

### Visual polish
- Column header with configurable color strip
- Task cards with hover elevation, subtle border glow on active card
- Priority-colored left border: CRITICAL=red, HIGH=orange, MEDIUM=yellow, LOW/NONE=gray
- Empty column state with illustration + "Add your first task" prompt
- Task count badge with count animation
- Smooth horizontal column scroll

### New features

**Drag & drop:**
- Install `@dnd-kit/core` and `@dnd-kit/sortable`
- Drag tasks between columns — calls `PATCH /tasks/:taskId/move { columnId, position }` on drop
- Drag to reorder within same column
- Drag column headers to reorder columns — calls `PATCH /columns/:columnId { position }`

**File uploads:**
- Upload button in board header
- File list sidebar (toggleable) showing files for this board — calls `GET /workspaces/:workspaceId/uploads/boards/:boardId`
- Upload via multipart form — calls `POST /workspaces/:workspaceId/uploads` with `boardId`
- Delete file button

**AI features:**
- "Summarize" button in header — calls `POST /ai/boards/:boardId/summarize`, shows result in a slide-over panel with markdown rendering
- "Generate ideas" button — opens a prompt dialog, calls `POST /ai/ideas { topic }`, offers to create sticky notes on canvas

**Task modal improvements:**
- User picker — search and select users from workspace instead of raw ID input
- Due date picker (native `<input type="date">`)
- Comments count shown on task card
- **Task checklist / subtasks** — expand checklist items within task with progress bar (new backend table + endpoints needed)
- **Filter & search tasks** — filter bar above columns: search by title, filter by priority, filter by assignee
- **Board templates** — on board create, offer templates (Sprint, Project, Personal) that pre-populate columns

### New backend endpoints needed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /tasks/:taskId/checklist` | GET | List checklist items |
| `POST /tasks/:taskId/checklist` | POST | Create checklist item |
| `PATCH /checklist/:itemId` | PATCH | Update/complete checklist item |
| `DELETE /checklist/:itemId` | DELETE | Remove checklist item |
| `POST /boards/templates` | POST | Create board from template |

---

## Phase 5: Canvas

**Files:** `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/*`

### Toolbar
- Floating toolbar at top with tool groups separated by dividers
- Tools: Select, Rectangle, Ellipse, Line, Arrow, Text, Sticky Note, Connector
- Color picker (fill + stroke) with preset swatches
- Stroke width slider (1-10px)
- Opacity slider (0-1)
- Active tool highlighted with accent color
- All buttons have icon + tooltip

### Canvas interactions
- Zoom: buttons + Ctrl+Scroll (zoom range 25%-400%)
- Pan: middle mouse drag or spacebar + left drag
- Grid background toggle — configurable grid size (10/20/50px)
- Snap to grid on resize/move
- Multi-select: Shift+click or drag-select rectangle
- Right-click context menu: Copy, Paste, Delete, Bring to Front, Send to Back, Duplicate
- Undo/redo stack (50 actions, local only — not synced)

### Object manipulation
- 8 resize handles (corners + midpoints) on selected objects
- Rotation handle above top-center
- Align tools: left, center, right, top, middle, bottom
- Distribute evenly: horizontal, vertical
- Layer panel — sidebar listing all objects by z-order, drag to reorder, eye icon to toggle visibility

### New features
- **Image upload:** Upload from file picker or paste from clipboard, places image on canvas at click position
- **Connector tool:** Draw arrows/lines between objects; connectors follow when objects are moved
- **Inline text editing:** Double-click text or sticky note to edit content directly on canvas
- **Sticky note colors:** Preset colors (yellow, blue, green, pink, orange) in a quick-pick palette
- **Measurement/ruler tool:** Toggleable ruler guides along top/left edges; show distance when dragging guides

### Presence
- Other users' cursors shown as colored dots with name label
- Online user avatars in collapsible sidebar panel
- Object editing indicator — show which user is currently modifying an object

---

## Phase 6: Users Pages

**Files:** `apps/web/app/users/*`

### User list (`/users`)
- Real-time search with 200ms debounce (client-side filter + API search)
- Pagination with page number buttons, not just prev/next
- Column layout: avatar, display name, email, status badge, email verified check, join date
- Sort by name, email, join date (click column header)
- Delete with confirmation modal
- Empty state for no search results
- Skeleton loading rows

### User detail (`/users/[id]`)
- Profile header: large avatar, display name, email, status badge
- Detail card in clean 2-column grid: email, status, email verified, timezone, locale, joined date, bio
- Workspace memberships section — list workspaces the user belongs to
- **User activity timeline** — recent actions filtered by userId (uses audit log from Phase 3)
- Edit button (navigates to settings if own profile)
- Back arrow to user list

---

## Phase 7: Settings

**Files:** `apps/web/app/settings/*`

### Tabs/sections

**Profile tab:**
- Display name (existing, refined with live character count)
- Bio textarea (new — backend `UserProfile.bio` exists)
- Avatar upload — click avatar circle, file picker, uploads via uploads endpoint

**Security tab:**
- Change password: current password + new + confirm, calls existing `POST /auth/reset-password`
- **Session management:** list active sessions with device info, last active, revoke button
  - New backend endpoint: `GET /auth/sessions` (list), `DELETE /auth/sessions/:id` (revoke)
  - Frontend: table of sessions with revoke confirmation modal

**Preferences tab:**
- Timezone select (IANA list with search)
- Locale select
- **Notification preferences:** per-workspace toggle for notification types
  - New backend table: `notification_preferences` (userId, workspaceId, type, enabled)
  - New endpoints: `GET /notification-preferences`, `PATCH /notification-preferences`

**Danger zone:**
- Delete account with multi-step confirmation modal (type "DELETE" to confirm)

### Cross-cutting
- Save button shows toast (success/error)
- Unsaved changes warning (`beforeunload` + Next.js route guard)

---

## Phase 8: Notifications

**Files:** `apps/web/app/notifications/*`, `apps/web/components/notifications-dropdown.tsx`

### Page (`/notifications`)
- Group by date: Today, Yesterday, This Week, Older
- Filter tabs: All, Unread, Archived
- Animate list items (fade-in on mount, slide-out on archive)
- Type icons per notification type: UserPlus=invite, MessageSquare=comment, Layout=board, Bell=generic
- Click navigates to relevant resource
- "Mark all read" with optimistic UI
- Empty state per filter tab

### Dropdown
- Poll every 15s for new count + list
- Scrollable with max 300px height
- "View all" link at bottom
- Unread badge with pulse animation on new count

### Interactions
- **Undo toast:** "Notification archived — Undo" with 5s auto-dismiss
- Swipe-to-dismiss on touch devices

### Push notifications (new)
- **Backend:** VAPID key setup, push subscription endpoint (`POST /push/subscribe`, `DELETE /push/unsubscribe`), send push on notification events
- **Frontend:** Service Worker registration, subscribe on login, handle push events, show notification, navigate on click

---

## Phase 9: Cross-cutting Infrastructure

### Auto token refresh
- Middleware in `apps/web/lib/api.ts`
- On 401 response, call `POST /auth/refresh` with stored refresh token
- Queue concurrent requests during refresh to avoid thundering herd
- On refresh failure, clear session and redirect to login
- Retry original request with new token

### Toast notification system
- React context + provider at app root
- Functions: `toast.success(msg)`, `toast.error(msg)`, `toast.info(msg)`, `toast.undo(msg, onUndo)`
- Auto-dismiss after 4s (success/info) or 8s (error)
- Stack multiple toasts vertically
- Position: bottom-right

### Confirmation modal
- Reusable component: `ConfirmModal { title, description, confirmLabel, cancelLabel, variant, onConfirm, onCancel }`
- Replaces all `confirm()` calls
- Variants: danger (red button), default (primary)
- Keyboard: Enter confirms, Escape cancels
- Focus trap inside modal

### Keyboard shortcuts
- `g d` → `/dashboard`
- `g n` → `/notifications`
- `g s` → `/settings`
- `g u` → `/users`
- `?` → overlay cheat sheet
- Registered in a global `useEffect` in the authenticated layout

### Page transitions
- CSS `@keyframes fadeIn` on main content area
- 150ms ease-in-out
- No layout shift — use `opacity` and `transform: translateY(4px)`

### Global loading bar
- Thin (3px) bar at top of viewport during navigation
- Use Next.js `loading.tsx` + custom `useNavigation` hook
- Animated gradient (primary-500 to primary-300)

### Error boundary
- Per-page error boundary component
- Shows "Something went wrong" with retry button
- Logs error to console
- Graceful fallback without breaking the sidebar

### Responsive / mobile layout
- Authenticated layout: sidebar becomes off-canvas drawer on screens <1024px
- Mobile nav: bottom tab bar with icons instead of sidebar
- All pages tested at 320px, 768px, 1024px, 1440px breakpoints
- Touch targets minimum 44x44px on interactive elements

---

## Implementation Order

Phases are designed to be implemented sequentially. Each phase builds on the previous one.

1. **Phase 9** (Cross-cutting) should ideally start first — toast system, confirmation modal, error boundary, and token refresh are prerequisites for every other phase
2. **Phase 1** (Auth) — independent, can parallel with Phase 9
3. **Phase 2** (Dashboard + Sidebar)
4. **Phase 3** (Workspace detail + new boards page + audit log backend)
5. **Phase 4** (Board/Kanban + drag-drop + AI + files)
6. **Phase 5** (Canvas enhancements)
7. **Phase 6** (Users pages)
8. **Phase 7** (Settings)
9. **Phase 8** (Notifications + push)

## New Backend Work Required

| Module | Endpoints | Phase |
|--------|-----------|-------|
| Audit Log | `GET /workspaces/:id/activity` | 3 |
| Workspace | `POST /workspaces/:id/transfer` | 3 |
| Boards | `POST /boards/export`, `POST /boards/import` | 3 |
| Tasks | Checklist CRUD endpoints | 4 |
| Boards | `POST /boards/templates` | 4 |
| Auth | `GET /auth/sessions`, `DELETE /auth/sessions/:id` | 7 |
| Notifications | `GET /notification-preferences`, `PATCH /notification-preferences` | 7 |
| Push | `POST /push/subscribe`, `DELETE /push/unsubscribe` | 8 |
