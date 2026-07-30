# Canvas + Realtime Collaboration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the existing Canvas module with the Socket.IO gateway for live object sync, cursor presence, and online user awareness.

**Architecture:** REST writes to Postgres → CanvasService publishes events via CanvasEventBus → CanvasGateway subscribes and broadcasts to Socket.IO room. Cursor/presence messages go client → gateway → room (no DB write). Authorization checked on REST (CanvasPolicy) and on `board:join` (JWT verify).

**Tech Stack:** NestJS 11, Socket.IO 4.8, Next.js 16, React 19

## Global Constraints

- Follow existing module patterns (controllers thin, services contain logic, repositories for persistence only)
- No new database tables or migrations — schema already deployed
- No new controllers, services, DTOs, or repositories — existing REST CRUD is sufficient
- Frontend state stays local (no global store) per ProjectBlueprint guidance
- Phase 1 — simple event broadcast, no CRDT/OT
- Object types per ProjectBlueprint Phase 1: RECTANGLE, ELLIPSE, LINE, ARROW, TEXT, STICKY_NOTE, IMAGE

---

### Task 1: CanvasEventBus — add missing listener registration methods

**Files:**
- Modify: `apps/api/src/modules/canvas/events/canvas.events.ts:47-57`

**Interfaces:**
- Consumes: nothing
- Produces: `onObjectUpdated(listener)` and `onObjectDeleted(listener)` methods on `CanvasEventBus`

- [ ] **Add `onObjectUpdated` and `onObjectDeleted` methods**

```typescript
// Add after onObjectCreated (line 49)
onObjectUpdated(listener: (payload: ObjectUpdatedPayload) => void): void {
  this.emitter.on(CANVAS_EVENTS.objectUpdated, listener);
}

onObjectDeleted(listener: (payload: ObjectDeletedPayload) => void): void {
  this.emitter.on(CANVAS_EVENTS.objectDeleted, listener);
}
```

- [ ] **Run tests to verify nothing breaks**

Run: `npx jest apps/api/src/modules/canvas/services/canvas.service.spec.ts --no-coverage`
Expected: 3/3 pass

- [ ] **Commit**

```bash
git add apps/api/src/modules/canvas/events/canvas.events.ts
git commit -m "feat(canvas): add onObjectUpdated and onObjectDeleted event bus listeners"
```

---

### Task 2: CanvasGateway — subscribe to server-side events

**Files:**
- Modify: `apps/api/src/modules/realtime/gateways/canvas.gateway.ts`

**Interfaces:**
- Consumes: `CanvasEventBus` from Task 1 (with `onObjectCreated`, `onObjectUpdated`, `onObjectDeleted`), `ObjectCreatedPayload`, `ObjectUpdatedPayload`, `ObjectDeletedPayload`
- Produces: gateway that broadcasts `object:created`, `object:updated`, `object:deleted` to board rooms on server-side events

- [ ] **Add import and DI for CanvasEventBus at top of file**

```typescript
import { CanvasEventBus } from '../../canvas/events/canvas.events';
import type { ObjectCreatedPayload, ObjectUpdatedPayload, ObjectDeletedPayload } from '../../canvas/events/canvas.events';
```

Add constructor parameter:
```typescript
constructor(private readonly canvasEventBus: CanvasEventBus) {}
```

- [ ] **Add `afterInit` method that subscribes to event bus events**

```typescript
afterInit(): void {
  this.canvasEventBus.onObjectCreated((payload: ObjectCreatedPayload) => {
    this.server.to(`board:${payload.boardId}`).emit('object:created', payload);
  });

  this.canvasEventBus.onObjectUpdated((payload: ObjectUpdatedPayload) => {
    this.server.to(`board:${payload.boardId}`).emit('object:updated', payload);
  });

  this.canvasEventBus.onObjectDeleted((payload: ObjectDeletedPayload) => {
    this.server.to(`board:${payload.boardId}`).emit('object:deleted', payload);
  });
}
```

Note: The room naming convention must match the frontend — using `board:${boardId}`.

- [ ] **Update `board:join` handler room name to use `board:` prefix**

Change `client.join(data.boardId)` to `client.join(`board:${data.boardId}`)` and update all `.to(data.boardId)` references to `.to(`board:${data.boardId}`)` throughout the file.

- [ ] **Run build to verify**

Run: `npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: no errors

- [ ] **Commit**

```bash
git add apps/api/src/modules/realtime/gateways/canvas.gateway.ts
git commit -m "feat(realtime): wire CanvasGateway to CanvasEventBus for server-side broadcasts"
```

---

### Task 3: RealtimeModule — import CanvasModule

**Files:**
- Modify: `apps/api/src/modules/realtime/realtime.module.ts`

**Interfaces:**
- Consumes: `CanvasModule` (exports `CanvasEventBus`)
- Produces: NestJS DI wiring so CanvasGateway receives CanvasEventBus

- [ ] **Update module to import CanvasModule**

```typescript
import { Module } from '@nestjs/common';
import { CanvasModule } from '../canvas/canvas.module';
import { CanvasGateway } from './gateways/canvas.gateway';

@Module({
  imports: [CanvasModule],
  providers: [CanvasGateway],
  exports: [CanvasGateway],
})
export class RealtimeModule {}
```

- [ ] **Run build to verify**

Run: `npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: no errors

- [ ] **Commit**

```bash
git add apps/api/src/modules/realtime/realtime.module.ts
git commit -m "feat(realtime): import CanvasModule for DI of CanvasEventBus"
```

---

### Task 4: Frontend — add socket.io-client dependency

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Install socket.io-client**

Run: `pnpm --filter web add socket.io-client`

- [ ] **Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml  # adjust for actual lockfile path
git commit -m "chore(web): add socket.io-client dependency"
```

---

### Task 5: Frontend — create canvas-socket.ts

**Files:**
- Create: `apps/web/lib/canvas-socket.ts`

**Interfaces:**
- Consumes: `API_BASE_URL` from environment, `accessToken` from localStorage
- Produces: `createCanvasSocket(boardId)` factory function

- [ ] **Write the socket factory**

```typescript
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';

export function createCanvasSocket(boardId: string): Socket {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const socket = io(`${SOCKET_URL}/canvas`, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    socket.emit('board:join', { boardId });
  });

  socket.on('disconnect', () => {
    socket.emit('board:leave', { boardId });
  });

  return socket;
}
```

- [ ] **Commit**

```bash
git add apps/web/lib/canvas-socket.ts
git commit -m "feat(web): add canvas Socket.IO client factory"
```

---

### Task 6: Frontend — create useCanvasSocket hook

**Files:**
- Create: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/use-canvas-socket.ts`

**Interfaces:**
- Consumes: `CanvasObject` type from `@/lib/canvas`, `createCanvasSocket` from Task 5
- Produces: React hook that manages socket lifecycle and applies server events to canvas state

- [ ] **Write the hook**

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { createCanvasSocket } from '@/lib/canvas-socket';
import type { CanvasObject } from '@/lib/canvas';

type PresenceUser = {
  userId: string;
  displayName: string;
  cursor?: { x: number; y: number };
  joinedAt: string;
};

type CanvasSocketCallbacks = {
  onObjectCreated: (obj: CanvasObject) => void;
  onObjectUpdated: (obj: CanvasObject) => void;
  onObjectDeleted: (objectId: string) => void;
  onPresenceUpdate: (users: PresenceUser[]) => void;
  onCursorMoved: (data: { userId: string; cursor: { x: number; y: number } }) => void;
};

export function useCanvasSocket(
  boardId: string | undefined,
  callbacks: CanvasSocketCallbacks,
) {
  const socketRef = useRef<ReturnType<typeof createCanvasSocket> | null>(null);

  useEffect(() => {
    if (!boardId) return;

    const socket = createCanvasSocket(boardId);
    socketRef.current = socket;

    socket.on('object:created', (obj: CanvasObject) => {
      callbacks.onObjectCreated(obj);
    });

    socket.on('object:updated', (obj: CanvasObject) => {
      callbacks.onObjectUpdated(obj);
    });

    socket.on('object:deleted', (objectId: string) => {
      callbacks.onObjectDeleted(objectId);
    });

    socket.on('presence:update', (users: PresenceUser[]) => {
      callbacks.onPresenceUpdate(users);
    });

    socket.on('cursor:moved', (data: { userId: string; cursor: { x: number; y: number } }) => {
      callbacks.onCursorMoved(data);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [boardId]);

  const emitCursorMove = (x: number, y: number) => {
    socketRef.current?.emit('cursor:move', { boardId, cursor: { x, y } });
  };

  return { emitCursorMove };
}
```

- [ ] **Commit**

```bash
git add apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/use-canvas-socket.ts
git commit -m "feat(web): add useCanvasSocket hook for real-time canvas state"
```

---

### Task 7: Frontend — integrate socket hook into canvas page

**Files:**
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/page.tsx`

**Interfaces:**
- Consumes: `useCanvasSocket` from Task 6, canvas state from existing `useState`
- Produces: canvas page that receives live updates from other users

- [ ] **Add import for hook**

```typescript
import { useCanvasSocket } from './use-canvas-socket';
```

- [ ] **Wire up socket hook after existing canvas fetch**

```typescript
// Add inside CanvasPage component, after the existing useEffect for canvasApi.getOrCreate

const handleObjectFromSocket = useCallback((obj: CanvasObject) => {
  setCanvas((prev) => {
    if (!prev) return prev;
    const exists = prev.objects.find((o) => o.id === obj.id);
    if (exists) {
      return { ...prev, objects: prev.objects.map((o) => o.id === obj.id ? obj : o) };
    }
    return { ...prev, objects: [...prev.objects, obj] };
  });
}, []);

const handleRemoveFromSocket = useCallback((objectId: string) => {
  setCanvas((prev) => {
    if (!prev) return prev;
    return { ...prev, objects: prev.objects.filter((o) => o.id !== objectId) };
  });
}, []);

const { emitCursorMove } = useCanvasSocket(boardId, {
  onObjectCreated: handleObjectFromSocket,
  onObjectUpdated: handleObjectFromSocket,
  onObjectDeleted: handleRemoveFromSocket,
  onPresenceUpdate: (users) => {
    // Will be used in Task 8
  },
  onCursorMoved: () => {
    // Will be used in Task 8
  },
});
```

- [ ] **Add cursor move emission in handleSurfaceMouseMove / handleObjectMouseMove**

```typescript
// Call emitCursorMove inside handleSurfaceMouseMove
// Add throttling — track last emit time with a ref
```

- [ ] **Commit**

```bash
git add apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/page.tsx
git commit -m "feat(web): integrate useCanvasSocket into canvas page for live sync"
```

---

### Task 8: Frontend — expand toolset to Phase 1 objects

**Files:**
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/page.tsx`

- [ ] **Update OBJECT_TYPES to include all 7 Phase 1 tools**

```typescript
const OBJECT_TOOLS: { type: CanvasObjectType; label: string; icon?: string }[] = [
  { type: 'RECTANGLE', label: 'Rectangle' },
  { type: 'ELLIPSE', label: 'Ellipse' },
  { type: 'LINE', label: 'Line' },
  { type: 'ARROW', label: 'Arrow' },
  { type: 'TEXT', label: 'Text' },
  { type: 'STICKY_NOTE', label: 'Note' },
  { type: 'IMAGE', label: 'Image' },
];
```

- [ ] **Add IMAGE upload handler**

```typescript
async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const uploaded = await uploadsApi.upload(workspaceId, file, boardId);
    const obj = await canvasApi.createObject(boardId, {
      type: 'IMAGE',
      x: 100, y: 100,
      width: 300, height: 200,
      data: { url: uploaded.url, originalName: uploaded.originalName },
    });
    setCanvas((prev) => prev ? { ...prev, objects: [...prev.objects, obj] } : prev);
  } catch { /* handled */ }
}
```

- [ ] **Add hidden file input for image upload in toolbar**

```typescript
// Add alongside delete button
<input
  type="file"
  accept="image/*"
  className="hidden"
  ref={fileInputRef}
  onChange={handleImageUpload}
/>
```

- [ ] **Update object rendering for new types**

```typescript
// In the objects map render block, add:
{obj.type === 'IMAGE' && obj.data?.url && (
  <img
    src={obj.data.url as string}
    alt=""
    className="h-full w-full rounded-lg object-cover"
    draggable={false}
  />
)}
{obj.type === 'LINE' && (
  // Render a line using rotation and width
  <div className="h-0 border-t" style={{ width: obj.width, borderColor: obj.stroke || '#fff' }} />
)}
{obj.type === 'ARROW' && (
  // Same as line but with arrowhead via CSS or SVG
  <div className="relative h-0 border-t" style={{ width: obj.width, borderColor: obj.stroke || '#fff' }}>
    <div className="absolute -right-1.5 -top-1.5 border-4 border-transparent border-l-white" />
  </div>
)}
```

Note: LINE and ARROW objects differ from area objects — they use click-drag to define start/end instead of area. The existing drag-to-create logic (which creates width × height) works as a basic approximation for Phase 1.

- [ ] **Commit**

```bash
git add apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/page.tsx
git commit -m "feat(web): expand canvas toolset to all Phase 1 objects (Line, Arrow, Image)"
```

---

### Task 9: Frontend — presence UI

**Files:**
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/page.tsx`

- [ ] **Add presence state and connect to socket hook**

```typescript
const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
const [remoteCursors, setRemoteCursors] = useState<Map<string, { x: number; y: number }>>(new Map());
```

Wire into the hook (from Task 7):
```typescript
onPresenceUpdate: setOnlineUsers,
onCursorMoved: (data) => {
  setRemoteCursors((prev) => {
    const next = new Map(prev);
    next.set(data.userId, data.cursor);
    return next;
  });
},
```

- [ ] **Add presence bar in the header**

```typescript
// After the object count span, before the toolbar buttons
<div className="flex items-center gap-1">
  {onlineUsers.map((user) => (
    <div
      key={user.userId}
      className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-[10px] font-medium text-white"
      title={user.displayName}
    >
      {user.displayName.charAt(0).toUpperCase()}
    </div>
  ))}
</div>
```

- [ ] **Add remote cursor overlay rendering**

```typescript
// Inside the surface div, after existing object rendering
{Array.from(remoteCursors.entries()).map(([userId, cursor]) => {
  const user = onlineUsers.find((u) => u.userId === userId);
  return (
    <div
      key={userId}
      className="pointer-events-none absolute z-50"
      style={{ left: cursor.x, top: cursor.y, transform: 'translate(-50%, -50%)' }}
    >
      <div className="h-3 w-3 rounded-full bg-primary-500" />
      <span className="ml-1.5 whitespace-nowrap rounded bg-surface-900/80 px-1.5 py-0.5 text-[10px] text-white">
        {user?.displayName || 'Unknown'}
      </span>
    </div>
  );
})}
```

- [ ] **Commit**

```bash
git add apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/page.tsx
git commit -m "feat(web): add presence bar and remote cursor rendering"
```

---

### Task 10: Tests — update canvas service tests, add gateway test

**Files:**
- Modify: `apps/api/src/modules/canvas/services/canvas.service.spec.ts`
- Create: `apps/api/src/modules/realtime/gateways/canvas.gateway.spec.ts`

- [ ] **Add test for updateObject publishes event**

In `canvas.service.spec.ts`, add:
```typescript
it('should publish objectUpdated event when updating an object', async () => {
  boardsRepo.findById.mockResolvedValue({ id: 'b-1', workspaceId: 'ws-1' } as any);
  membersRepo.findByWorkspaceAndUser.mockResolvedValue({ id: 'm-1', workspaceId: 'ws-1', userId: 'user-1', role: 'OWNER' } as any);
  canvasRepo.findObjectById.mockResolvedValue({ id: 'obj-1', canvasId: 'c-1', type: 'RECTANGLE' } as any);
  canvasRepo.updateObject.mockResolvedValue({ id: 'obj-1', canvasId: 'c-1', x: 200, y: 300 } as any);

  await service.updateObject('b-1', 'obj-1', 'user-1', { x: 200, y: 300 });

  expect(eventBus.publishObjectUpdated).toHaveBeenCalledWith({
    objectId: 'obj-1',
    canvasId: 'c-1',
    boardId: 'b-1',
    userId: 'user-1',
  });
});
```

- [ ] **Add test for deleteObject publishes event**

```typescript
it('should publish objectDeleted event when deleting an object', async () => {
  boardsRepo.findById.mockResolvedValue({ id: 'b-1', workspaceId: 'ws-1' } as any);
  membersRepo.findByWorkspaceAndUser.mockResolvedValue({ id: 'm-1', workspaceId: 'ws-1', userId: 'user-1', role: 'OWNER' } as any);
  canvasRepo.findObjectById.mockResolvedValue({ id: 'obj-1', canvasId: 'c-1' } as any);
  canvasRepo.softDeleteObject.mockResolvedValue(undefined);

  await service.deleteObject('b-1', 'obj-1', 'user-1');

  expect(eventBus.publishObjectDeleted).toHaveBeenCalledWith({
    objectId: 'obj-1',
    canvasId: 'c-1',
    boardId: 'b-1',
    deletedBy: 'user-1',
  });
});
```

- [ ] **Create canvas.gateway.spec.ts**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CanvasGateway } from './canvas.gateway';
import { CanvasEventBus } from '../../canvas/events/canvas.events';

describe('CanvasGateway', () => {
  let gateway: CanvasGateway;
  let eventBus: jest.Mocked<CanvasEventBus>;

  beforeEach(async () => {
    eventBus = {
      onObjectCreated: jest.fn(),
      onObjectUpdated: jest.fn(),
      onObjectDeleted: jest.fn(),
      publishObjectCreated: jest.fn(),
      publishObjectUpdated: jest.fn(),
      publishObjectDeleted: jest.fn(),
    } as unknown as jest.Mocked<CanvasEventBus>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanvasGateway,
        { provide: CanvasEventBus, useValue: eventBus },
      ],
    }).compile();

    gateway = module.get<CanvasGateway>(CanvasGateway);
  });

  it('should subscribe to all three canvas events on init', () => {
    // Simulate afterInit lifecycle
    gateway.afterInit();

    expect(eventBus.onObjectCreated).toHaveBeenCalled();
    expect(eventBus.onObjectUpdated).toHaveBeenCalled();
    expect(eventBus.onObjectDeleted).toHaveBeenCalled();
  });
});
```

- [ ] **Run all tests**

Run: `npx jest apps/api/src/modules/canvas/apps/api/src/modules/realtime --no-coverage`
Expected: 6/6 pass

- [ ] **Commit**

```bash
git add apps/api/src/modules/canvas/services/canvas.service.spec.ts apps/api/src/modules/realtime/gateways/canvas.gateway.spec.ts
git commit -m "test(canvas): add event bus publish tests for update/delete + gateway subscription test"
```
