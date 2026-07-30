# Canvas + Realtime Collaboration — Design Spec

## Purpose

Wire up the existing Canvas module with the Socket.IO gateway for real-time collaboration: live object sync, cursor presence, and online user awareness — following the Phase 1 "simple event synchronization" strategy from the ProjectBlueprint.

## Architecture

```
Frontend (Next.js)          Backend (NestJS)
┌──────────────────┐        ┌──────────────────────────────────────┐
│  Canvas Page      │  REST  │  CanvasService → CanvasRepository   │
│  useCanvasSocket  │ ───→   │    → Postgres (source of truth)     │
│  useCanvasState   │        │      ↓ publishes                    │
│  usePresence      │        │  CanvasEventBus                      │
│                   │        │      ↓ subscribes                    │
│  Socket.IO Client │ ←──── │  CanvasGateway (/canvas namespace)   │
│  (auto-join room) │        │    → broadcasts to room             │
└──────────────────┘        └──────────────────────────────────────┘
```

- REST writes to Postgres → CanvasService publishes event → Gateway broadcasts
- Cursor/presence messages go client → Gateway → room (no DB write)
- Authorization checked on REST (CanvasPolicy) and on `board:join` (JWT verify)

## Backend Changes

### CanvasGateway (`apps/api/src/modules/realtime/gateways/canvas.gateway.ts`)

**New dependencies:** inject `CanvasEventBus`

**New subscriptions in `afterInit()` or `onModuleInit()`:**
- `canvasEventBus.onObjectCreated()` → `serverEmit('object:created')` to room
- `canvasEventBus.onObjectUpdated()` → `serverEmit('object:updated')` to room
- `canvasEventBus.onObjectDeleted()` → `serverEmit('object:deleted')` to room

**Existing keepers:**
- `board:join` / `board:leave` — JWT auth, room join/leave, presence tracking
- `cursor:move` — relay to others in room
- `object:created` / `object:updated` / `object:deleted` — relay from client (still useful for optimistic, but server is source of truth)

**Add:**
- `selection:changed` relay — broadcast selected object IDs to room

### CanvasEventBus (`apps/api/src/modules/canvas/events/canvas.events.ts`)

**Add missing listener registration methods:**
- `onObjectUpdated(handler)` — register listener for `CanvasObjectUpdated`
- `onObjectDeleted(handler)` — register listener for `CanvasObjectDeleted`

### RealtimeModule (`apps/api/src/modules/realtime/realtime.module.ts`)

**New imports:** `CanvasModule` (to get `CanvasEventBus`)
**Updated providers:** inject `CanvasEventBus` into `CanvasGateway`

### CanvasModule (`apps/api/src/modules/canvas/canvas.module.ts`)

**Export:** ensure `CanvasEventBus` is exported (check — already is in scaffold)

### Radial changes

- **No new controllers, services, DTOs, or repositories** — existing REST CRUD is sufficient
- **No new database tables or migrations**

## Frontend Changes

### New: `apps/web/lib/canvas-socket.ts`

Socket.IO client factory:
```ts
function createCanvasSocket(boardId: string): Socket
```
- Connects to `${API_URL}/canvas` namespace
- Auth via `{ auth: { token } }` from localStorage
- Auto-joins `board:${boardId}` room on connect
- Leaves on disconnect

### New: `useCanvasSocket` hook

Placed in `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/`

**Listens for:**
- `object:created` → append to canvas state
- `object:updated` → replace object in state
- `object:deleted` → remove from state
- `presence:update` → update online users list
- `cursor:moved` → update remote cursor positions

**Emits:**
- `cursor:move` on mousemove (throttled to ~50ms)
- `board:join` / `board:leave` (handled by socket lifecycle)

### Canvas page (`apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/page.tsx`)

**Toolbar — expand to 7 tools:**
- Rectangle (existing)
- Ellipse (existing)
- Line (new — click-drag from start to end point)
- Arrow (new — same as line with arrowhead rendering)
- Text (existing)
- Sticky Note (existing as "Note")
- Image (new — triggers upload dialog, inserts uploaded image as object)

**Presence UI:**
- Top-right bar showing avatars of online users
- Remote cursor rendering: colored dot + user name label at cursor position
- Each user gets a deterministic color from their userId hash

**State:**
- Canvas state stays local (`useCanvasState` hook with `useState`/`useReducer`)
- Socket events patch into state — no REST refetch after initial load
- REST calls still made for writes (create/update/delete) — socket broadcasts back the result

### New: `apps/web/lib/canvas-api.ts` additions (optional)

- No mandatory changes — existing `canvasApi` wrapper covers all REST calls
- Image upload uses existing `uploadsApi.upload()` from `apps/web/lib/uploads.ts`

## Data Flow

### Object Created
1. User drags tool → `canvasApi.createObject(boardId, data)` → POST
2. `CanvasService` → DB insert → `eventBus.publishObjectCreated()`
3. `CanvasGateway` receives event → `serverEmit('object:created', payload)` to board room
4. All connected clients (except originator) receive → patch into state → object renders
5. Originator already has optimistic state from the REST response; deduplicate via ID

### Object Updated
1. User drags to move/resize → `canvasApi.updateObject(boardId, objectId, data)` → PATCH
2. Same flow: DB update → event → broadcast → other clients patch

### Object Deleted
1. User selects + delete → `canvasApi.deleteObject(boardId, objectId)` → DELETE
2. Same flow: DB soft-delete → event → broadcast → other clients remove

### Cursor Presence
1. User moves mouse → throttle ~50ms → `socket.emit('cursor:move', { x, y })`
2. Gateway broadcasts `cursor:moved` to room (excluding sender)
3. Receiving clients update cursor overlay positions

## Object Types (Phase 1)

Per ProjectBlueprint:
- RECTANGLE — existing, drag-to-create
- ELLIPSE — existing, drag-to-create
- LINE — new, click-drag from start to end
- ARROW — new, same as line with arrowhead
- TEXT — existing, click to place, type content
- STICKY_NOTE — existing as "Note", keeps that name
- IMAGE — new, upload then place

The DB enum already includes PATH, FRAME, CONNECTOR — these are Phase 2 deferred.

## Authorization

Per blueprint: "Authorization occurs before synchronization."

| Action | Check |
|--------|-------|
| View canvas | `CanvasPolicy.canView()` via REST (already exists) |
| Create/edit/delete objects | `CanvasPolicy.canEdit()` via REST (already exists) |
| Join board room | JWT verification in gateway handshake (already exists) |
| Receive broadcasts | Gateway only sends to room members; room join is gated |

## Error Handling

- Socket disconnect → show "Reconnecting..." banner; reconnect on socket event
- REST failure → revert optimistic state, show toast error
- Object version conflicts → last-write-wins (Phase 1); Phase 2 may add OT/CRDT

## Testing

- Existing canvas service tests (3 tests) — update to verify event bus calls
- New canvas gateway unit test — verify event bus subscription and broadcast
- Frontend: not adding formal tests in this phase (manual QA)

## Files Created

- `apps/web/lib/canvas-socket.ts`

## Files Modified

- `apps/api/src/modules/realtime/gateways/canvas.gateway.ts` — inject event bus, add subscriptions
- `apps/api/src/modules/realtime/realtime.module.ts` — import CanvasModule
- `apps/api/src/modules/canvas/events/canvas.events.ts` — add onObjectUpdated/onObjectDeleted
- `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/page.tsx` — full toolset, socket hook, presence

## Files Not Modified

- Canvas controller, service, repository, policy, DTOs — already complete
- Database schema and migrations — already deployed
- Uploads module — already exists; canvas image tool calls it
