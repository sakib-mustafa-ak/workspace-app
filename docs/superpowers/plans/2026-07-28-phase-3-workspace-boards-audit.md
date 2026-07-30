# Phase 3: Workspace Detail + Boards List + Audit Log

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full workspace detail page with tabbed navigation, enhanced boards list with search/archive/delete, invitation acceptance flow, audit log backend, board export/import, and ownership transfer.

**Tech Stack:** NestJS, Next.js 16, React 19, Tailwind CSS v4, lucide-react, Drizzle ORM, Postgres

## Global Constraints

- No new npm dependencies
- All audit event writes are fire-and-forget (never block the caller)
- Pagination uses cursor-based (`cursor` query param, returns `nextCursor` + `data` array)
- Frontend route conventions: `apps/web/app/workspaces/[workspaceId]/_components/*.tsx` for tab sub-components
- Audit module emits events via the same EventEmitter pattern used by workspaces/boards

---

### Task 1: Audit log database schema + NestJS module

**Files:**
- Create: `packages/database/src/schema/audit/audit.schema.ts`
- Create: `packages/database/src/schema/audit/audit.constants.ts`
- Create: `packages/database/src/schema/audit/index.ts`
- Modify: `packages/database/src/schema/index.ts`
- Create: `apps/api/src/modules/audit/audit.module.ts`
- Create: `apps/api/src/modules/audit/audit.constants.ts`
- Create: `apps/api/src/modules/audit/repositories/audit.repository.ts`
- Create: `apps/api/src/modules/audit/services/audit.service.ts`
- Create: `apps/api/src/modules/audit/controllers/audit.controller.ts`
- Create: `apps/api/src/modules/audit/dto/audit-response.dto.ts`
- Create: `apps/api/src/modules/audit/dto/activity-query.dto.ts`
- Create: `apps/api/src/modules/audit/errors/audit.errors.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create audit constants**

```ts
// packages/database/src/schema/audit/audit.constants.ts
export const auditEventsTableName = 'audit_events';
export const auditEventAlias = 'audit_event';
```

- [ ] **Step 2: Create audit schema**

```ts
// packages/database/src/schema/audit/audit.schema.ts
import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core';
import { CREATED_AT, PRIMARY_ID } from '../common.js';
import { workspaces } from '../workspaces/workspace.schema.js';
import { users } from '../users/user.schema.js';
import { auditEventAlias, auditEventsTableName } from './audit.constants.js';

export const auditEvents = pgTable(
  auditEventsTableName,
  {
    id: PRIMARY_ID(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: CREATED_AT(),
  },
  (table) => ({
    auditWorkspaceCreatedAtIndex: index('audit_workspace_created_at_idx').on(table.workspaceId, table.createdAt),
    auditActionIdx: index('audit_action_idx').on(table.action),
    auditResourceTypeIdx: index('audit_resource_type_idx').on(table.resourceType),
  }),
);

export type AuditEventRow = typeof auditEvents.$inferSelect;
export type NewAuditEventRow = typeof auditEvents.$inferInsert;

export const auditEventAccess = { table: auditEvents, alias: auditEventAlias };
```

- [ ] **Step 3: Export audit schema from database package**

```ts
// packages/database/src/schema/audit/index.ts
export * from './audit.constants.js';
export * from './audit.schema.js';
```

```ts
// packages/database/src/schema/index.ts — add line:
export * from './audit/index.js';
```

- [ ] **Step 4: Create audit NestJS module files**

```ts
// apps/api/src/modules/audit/audit.constants.ts
export const AUDIT_PAGE_SIZE = 50;
```

```ts
// apps/api/src/modules/audit/errors/audit.errors.ts
import { HttpException } from '@nestjs/common';

export const AuditErrorCode = {
  AUDIT_NOT_FOUND: 'AUDIT.NOT_FOUND',
} as const;

export type AuditErrorCode = (typeof AuditErrorCode)[keyof typeof AuditErrorCode];

const STATUS_BY_CODE: Readonly<Record<AuditErrorCode, number>> = {
  [AuditErrorCode.AUDIT_NOT_FOUND]: 404,
};

export class AuditException extends HttpException {
  constructor(code: AuditErrorCode, message: string) {
    super({ code, message }, STATUS_BY_CODE[code]);
  }
}
```

```ts
// apps/api/src/modules/audit/dto/audit-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

class AuditEventDto {
  @ApiProperty() id!: string;
  @ApiProperty() workspaceId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() action!: string;
  @ApiProperty() resourceType!: string;
  @ApiProperty({ nullable: true }) resourceId!: string | null;
  @ApiProperty() metadata!: Record<string, unknown>;
  @ApiProperty() createdAt!: Date;
}

export class ActivityResponseDto {
  @ApiProperty({ type: [AuditEventDto] })
  data!: AuditEventDto[];

  @ApiProperty({ nullable: true })
  nextCursor!: string | null;
}
```

```ts
// apps/api/src/modules/audit/dto/activity-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ActivityQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() cursor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() action?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resourceType?: string;
}
```

```ts
// apps/api/src/modules/audit/repositories/audit.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { and, DATABASE, desc, eq, lt, type Db, type NewAuditEventRow, type AuditEventRow, auditEvents } from '@repo/database';

@Injectable()
export class AuditRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async create(row: NewAuditEventRow): Promise<AuditEventRow> {
    const [created] = await this.db.insert(auditEvents).values(row).returning();
    if (!created) throw new Error('Failed to insert audit event.');
    return created;
  }

  public async listByWorkspace(
    workspaceId: string,
    opts: { cursor?: string; limit: number; action?: string; resourceType?: string },
  ): Promise<{ data: AuditEventRow[]; nextCursor: string | null }> {
    const { limit, action, resourceType } = opts;
    const conditions = [eq(auditEvents.workspaceId, workspaceId)];

    if (opts.cursor) {
      conditions.push(lt(auditEvents.createdAt, new Date(opts.cursor)));
    }
    if (action) conditions.push(eq(auditEvents.action, action));
    if (resourceType) conditions.push(eq(auditEvents.resourceType, resourceType));

    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();

    return {
      data: rows,
      nextCursor: hasMore && rows.length > 0
        ? rows[rows.length - 1].createdAt.toISOString()
        : null,
    };
  }
}
```

```ts
// apps/api/src/modules/audit/services/audit.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type Db, type NewAuditEventRow } from '@repo/database';
import { AuditRepository } from '../repositories/audit.repository';
import { AUDIT_PAGE_SIZE } from '../audit.constants';
import type { ActivityQueryDto } from '../dto/activity-query.dto';

@Injectable()
export class AuditService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(AuditRepository) private readonly repo: AuditRepository,
  ) {}

  public async record(event: NewAuditEventRow): Promise<void> {
    // fire-and-forget: never block the caller
    this.db.transaction(async (tx) => {
      // Use a separate query to avoid complex API — delegate to repo via db
    }).catch(() => {});
    await this.repo.create(event).catch(() => {});
  }

  public async getWorkspaceActivity(
    workspaceId: string,
    query: ActivityQueryDto,
  ) {
    return this.repo.listByWorkspace(workspaceId, {
      cursor: query.cursor,
      limit: AUDIT_PAGE_SIZE,
      action: query.action,
      resourceType: query.resourceType,
    });
  }
}
```

```ts
// apps/api/src/modules/audit/controllers/audit.controller.ts
import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../services/audit.service';
import { ActivityResponseDto } from '../dto/audit-response.dto';
import { ActivityQueryDto } from '../dto/activity-query.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller({ path: 'workspaces/:id/activity', version: '1' })
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get paginated workspace activity (audit log)' })
  @ApiOkResponse({ type: ActivityResponseDto })
  public async getActivity(
    @Param('id') id: string,
    @Query() query: ActivityQueryDto,
  ): Promise<ActivityResponseDto> {
    return this.audit.getWorkspaceActivity(id, query);
  }
}
```

```ts
// apps/api/src/modules/audit/audit.module.ts
import { Module } from '@nestjs/common';
import { AuditController } from './controllers/audit.controller';
import { AuditService } from './services/audit.service';
import { AuditRepository } from './repositories/audit.repository';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
```

- [ ] **Step 5: Register AuditModule in AppModule**

In `apps/api/src/app.module.ts`, add `AuditModule` to the imports array (before the closing `]`):

```ts
import { AuditModule } from './modules/audit/audit.module.js';
// ...
AuditModule,
```

- [ ] **Step 6: Commit**

```bash
git add packages/database/src/schema/audit/ apps/api/src/modules/audit/ apps/api/src/app.module.ts
git commit -m "feat(db): add audit_events schema and AuditModule"
```

---

### Task 2: Wire audit logging into workspace event bus

**Files:**
- Create: `apps/api/src/modules/audit/handlers/workspace-audit.handler.ts`
- Modify: `apps/api/src/modules/audit/audit.module.ts`

- [ ] **Step 1: Create audit handler that subscribes to workspace events**

```ts
// apps/api/src/modules/audit/handlers/workspace-audit.handler.ts
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { AuditService } from '../services/audit.service';
import { WorkspacesEventBus } from '../../workspaces/events/workspaces.events';

@Injectable()
export class WorkspaceAuditHandler implements OnModuleInit {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(WorkspacesEventBus) private readonly events: WorkspacesEventBus,
  ) {}

  onModuleInit() {
    this.events.onWorkspaceCreated((p) => {
      this.audit.record({ workspaceId: p.workspaceId, userId: p.ownerId, action: 'workspace.created', resourceType: 'workspace', resourceId: p.workspaceId, metadata: {} });
    });
    this.events.onMemberAdded((p) => {
      this.audit.record({ workspaceId: p.workspaceId, userId: p.userId, action: 'member.added', resourceType: 'member', resourceId: p.userId, metadata: { role: p.role } });
    });
    this.events.publishMemberRoleChanged // etc — subscribe to all relevant events
  }
}
```

Add handlers for all WORKSPACES_EVENTS (workspaceCreated, workspaceUpdated, workspaceArchived, workspaceDeleted, memberAdded, memberRoleChanged, memberRemoved, invitationCreated, invitationAccepted).

- [ ] **Step 2: Register handler in AuditModule**

```ts
// apps/api/src/modules/audit/audit.module.ts — add provider:
import { WorkspaceAuditHandler } from './handlers/workspace-audit.handler';
import { WorkspacesModule } from '../workspaces/workspaces.module';
// In imports: WorkspacesModule
// In providers: WorkspaceAuditHandler
```

- [ ] **Step 3: Also create a boards-audit handler that listens to BoardsEventBus**

Create `apps/api/src/modules/audit/handlers/board-audit.handler.ts` following same pattern, subscribing to boardCreated, boardUpdated, boardArchived, boardDeleted, columnCreated, columnUpdated, columnArchived.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/audit/handlers/ apps/api/src/modules/audit/audit.module.ts
git commit -m "feat(audit): wire workspace and board events into audit log"
```

---

### Task 3: GET /workspaces/:id/activity endpoint and frontend activity tab

**Files:**
- Modify: `apps/api/src/modules/audit/controllers/audit.controller.ts` (already created in Task 1 — verify it works)
- Modify: `apps/web/lib/workspaces.ts` — add activity API
- Modify: `apps/web/app/workspaces/[workspaceId]/page.tsx` — add activity tab

- [ ] **Step 1: Add `getActivity` to frontend API client**

```ts
// In apps/web/lib/workspaces.ts, at the end of workspacesApi:
getActivity: (id: string, params?: { cursor?: string; action?: string; resourceType?: string }) =>
  api.get<{ data: AuditEvent[]; nextCursor: string | null }>(`/workspaces/${id}/activity?${new URLSearchParams(params as any)}`),
```

Add type:
```ts
export type AuditEvent = {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};
```

- [ ] **Step 2: Add Activity tab to workspace detail page**

In `page.tsx`, add `'activity'` to the Tab union type, add an `Activity` icon icon to imports (`History` from lucide-react), and add the tab button:

```tsx
type Tab = 'boards' | 'members' | 'invitations' | 'settings' | 'activity';
// in tabs array:
{ key: 'activity', label: 'Activity', icon: History },
```

Add the activity content block:
```tsx
{tab === 'activity' && <ActivityTabContent workspaceId={workspaceId} />}
```

- [ ] **Step 3: Create ActivityTabContent component**

Either inline in `page.tsx` or extract to `apps/web/app/workspaces/[workspaceId]/_components/activity-tab.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { workspacesApi, type AuditEvent } from '@/lib/workspaces';
import { History, Loader2 } from 'lucide-react';

export function ActivityTabContent({ workspaceId }: { workspaceId: string }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  function load() {
    setLoading(true);
    workspacesApi.getActivity(workspaceId, { cursor: cursor ?? undefined })
      .then((res) => {
        setEvents((prev) => [...prev, ...res.data]);
        setCursor(res.nextCursor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [workspaceId]);

  function formatAction(action: string): string {
    return action.replace(/\./g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  if (loading && events.length === 0) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6">
      <h2 className="mb-4 text-sm font-semibold">Recent activity</h2>
      <div className="space-y-1">
        {events.length === 0 ? (
          <p className="text-sm text-surface-500">No activity yet</p>
        ) : (
          events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 rounded-lg border border-surface-800 bg-surface-900 px-4 py-3">
              <History size={14} className="mt-0.5 shrink-0 text-surface-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{formatAction(e.action)}</p>
                <p className="text-xs text-surface-500">{e.resourceType} · {new Date(e.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))
        )}
      </div>
      {cursor && (
        <button onClick={load} disabled={loading} className="mt-4 text-xs text-primary-400 hover:text-primary-300">
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/workspaces.ts apps/web/app/workspaces/[workspaceId]/page.tsx
git commit -m "feat(activity): add activity feed to workspace detail page"
```

---

### Task 4: POST /workspaces/:id/transfer — ownership transfer

**Files:**
- Create: `apps/api/src/modules/workspaces/dto/transfer-ownership.dto.ts`
- Modify: `apps/api/src/modules/workspaces/controllers/workspaces.controller.ts`
- Modify: `apps/api/src/modules/workspaces/services/workspaces.service.ts`
- Modify: `apps/api/src/modules/workspaces/errors/workspaces.errors.ts`
- Modify: `apps/api/src/modules/workspaces/events/workspaces.events.ts`
- Modify: `apps/web/lib/workspaces.ts`
- Modify: `apps/web/app/workspaces/[workspaceId]/page.tsx`

- [ ] **Step 1: Add error code**

```ts
// In workspaces.errors.ts, add to WorkspacesErrorCode:
TRANSFER_SAME_USER: 'WORKSPACE.TRANSFER_SAME_USER',
// Add to STATUS_BY_CODE:
[WorkspacesErrorCode.TRANSFER_SAME_USER]: 422,
```

- [ ] **Step 2: Add event payload type**

```ts
// In workspaces.events.ts, add:
export type WorkspaceTransferredPayload = {
  workspaceId: string;
  previousOwnerId: string;
  newOwnerId: string;
  transferredBy: string;
};
// Add to WORKSPACES_EVENTS:
workspaceTransferred: 'WorkspaceTransferred'
// Add to WorkspacesEventBus:
publishWorkspaceTransferred(payload: WorkspaceTransferredPayload): void { ... }
```

- [ ] **Step 3: Create DTO**

```ts
// apps/api/src/modules/workspaces/dto/transfer-ownership.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class TransferOwnershipDto {
  @ApiProperty({ description: 'ID of the user who will become the new owner' })
  @IsUUID()
  @IsString()
  newOwnerId!: string;
}
```

- [ ] **Step 4: Add service method**

In `workspaces.service.ts`:

```ts
public async transferOwnership(
  workspaceId: string,
  actorId: string,
  newOwnerId: string,
): Promise<WorkspaceRow> {
  if (actorId === newOwnerId) {
    throw new WorkspacesException(
      WorkspacesErrorCode.TRANSFER_SAME_USER,
      'You are already the owner.',
    );
  }

  await this.requireRole(workspaceId, actorId, 'OWNER');

  const membership = await this.members.findByWorkspaceAndUser(workspaceId, newOwnerId);
  if (!membership) {
    throw new WorkspacesException(
      WorkspacesErrorCode.MEMBERSHIP_NOT_FOUND,
      'Target user is not a member.',
    );
  }

  const ws = await this.workspacesRepo.findById(workspaceId);
  if (!ws) throw new WorkspacesException(WorkspacesErrorCode.WORKSPACE_NOT_FOUND, '');

  await this.db.transaction(async (tx) => {
    // Demote old owner to ADMIN
    await tx.update(workspaceMembers)
      .set({ role: 'ADMIN', updatedAt: new Date() })
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, actorId)));

    // Promote new owner
    await tx.update(workspaceMembers)
      .set({ role: 'OWNER', updatedAt: new Date() })
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, newOwnerId)));

    // Update workspace ownerId
    await tx.update(workspaces)
      .set({ ownerId: newOwnerId, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));
  });

  this.events.publishWorkspaceTransferred({ workspaceId, previousOwnerId: actorId, newOwnerId, transferredBy: actorId });
  return this.workspacesRepo.findById(workspaceId) as Promise<WorkspaceRow>;
}
```

- [ ] **Step 5: Add controller endpoint**

```ts
// In workspaces.controller.ts:
@Post(':id/transfer')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Transfer workspace ownership' })
@ApiOkResponse({ type: WorkspaceResponseDto })
public async transferOwnership(
  @CurrentUser() user: CurrentUserModel,
  @Param('id') id: string,
  @Body() body: TransferOwnershipDto,
): Promise<WorkspaceResponseDto> {
  const ws = await this.workspaces.transferOwnership(id, user.id, body.newOwnerId);
  return toWorkspaceResponse(ws);
}
```

- [ ] **Step 6: Add frontend API method**

```ts
// In workspaces.ts lib:
transferOwnership: (id: string, newOwnerId: string) =>
  api.post<Workspace>(`/workspaces/${id}/transfer`, { newOwnerId }),
```

- [ ] **Step 7: Add transfer UI to Settings tab**

In `page.tsx`, in the settings section, add a transfer ownership dropdown that lists members (requires loading members first):

```tsx
<hr className="border-surface-800" />
<h3 className="text-xs font-semibold text-surface-400">Danger zone</h3>
{wsOwner && (
  <div className="space-y-2">
    <label className="text-xs text-surface-400">Transfer ownership</label>
    <select
      onChange={async (e) => {
        if (e.target.value && confirm('Transfer ownership? This cannot be undone.')) {
          await workspacesApi.transferOwnership(workspaceId, e.target.value);
          loadWorkspace();
        }
      }}
      className="w-full rounded border border-surface-700 bg-surface-800 px-3 py-2 text-xs outline-none"
    >
      <option value="">Select new owner...</option>
      {members.filter((m) => m.userId !== user?.id).map((m) => (
        <option key={m.userId} value={m.userId}>{m.userId}</option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/workspaces/dto/transfer-ownership.dto.ts apps/api/src/modules/workspaces/controllers/ apps/api/src/modules/workspaces/services/ apps/api/src/modules/workspaces/errors/ apps/api/src/modules/workspaces/events/ apps/web/lib/workspaces.ts apps/web/app/workspaces/\[workspaceId\]/page.tsx
git commit -m "feat(workspaces): add ownership transfer endpoint and UI"
```

---

### Task 5: Boards export/import as JSON

**Files:**
- Create: `apps/api/src/modules/boards/dto/export-board.dto.ts`
- Create: `apps/api/src/modules/boards/dto/import-board.dto.ts`
- Modify: `apps/api/src/modules/boards/services/boards.service.ts`
- Modify: `apps/api/src/modules/boards/controllers/boards.controller.ts`
- Modify: `apps/api/src/modules/boards/errors/boards.errors.ts`
- Modify: `apps/web/lib/boards.ts`

- [ ] **Step 1: Add error codes**

```ts
// In boards.errors.ts:
EXPORT_FAILED: 'BOARD.EXPORT_FAILED',
IMPORT_FAILED: 'BOARD.IMPORT_FAILED',
// Add to STATUS_BY_CODE (both 500):
[BoardsErrorCode.EXPORT_FAILED]: 500,
[BoardsErrorCode.IMPORT_FAILED]: 500,
```

- [ ] **Step 2: Add service methods**

```ts
// In boards.service.ts:

export type BoardExportData = {
  board: { name: string; description: string | null };
  columns: { name: string; position: number }[];
  tasks: { title: string; description: string | null; position: number; priority: string; columnName: string }[];
};

public async exportBoard(boardId: string, userId: string): Promise<BoardExportData> {
  const board = await this.getById(boardId);
  await this.requireRole(board.workspaceId, userId, 'VIEWER');

  const columns = await this.columnsRepo.listByBoard(boardId);
  const allTasks = await this.tasksRepo.listByBoard(boardId); // need to inject TasksRepository

  return {
    board: { name: board.name, description: board.description },
    columns: columns.map((c) => ({ name: c.name, position: c.position })),
    tasks: allTasks.map((t) => ({
      title: t.title,
      description: t.description,
      position: t.position,
      priority: t.priority,
      columnName: columns.find((c) => c.id === t.columnId)?.name ?? '',
    })),
  };
}

public async importBoard(
  workspaceId: string,
  userId: string,
  data: BoardExportData,
): Promise<BoardRow> {
  await this.requireRole(workspaceId, userId, 'EDITOR');

  const board = await this.boardsRepo.create({
    workspaceId,
    name: data.board.name,
    description: data.board.description ?? null,
    position: 0,
  });

  const columnMap = new Map<string, string>();
  for (const col of data.columns) {
    const created = await this.columnsRepo.create({ boardId: board.id, name: col.name, position: col.position });
    columnMap.set(col.name, created.id);
  }

  for (const task of data.tasks) {
    const columnId = columnMap.get(task.columnName);
    if (!columnId) continue;
    await this.tasksRepo.create({ // inject TasksRepository
      boardId: board.id,
      workspaceId,
      columnId,
      title: task.title,
      description: task.description ?? null,
      position: task.position,
      priority: task.priority as any,
      createdById: userId,
    });
  }

  return board;
}
```

Note: Inject `TasksRepository` via constructor:
```ts
@Inject(TasksRepository) private readonly tasksRepo: TasksRepository,
```
And add `TasksModule` to `imports` in `BoardsModule`.

- [ ] **Step 3: Add controller endpoints**

```ts
@Post(':boardId/export')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Export a board as JSON' })
public async exportBoard(
  @CurrentUser() user: CurrentUserModel,
  @Param('boardId') boardId: string,
): Promise<BoardExportData> {
  return this.boards.exportBoard(boardId, user.id);
}

@Post('export')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Import a board from JSON' })
public async importBoard(
  @CurrentUser() user: CurrentUserModel,
  @Param('workspaceId') workspaceId: string,
  @Body() body: BoardExportData,
): Promise<BoardResponseDto> {
  const board = await this.boards.importBoard(workspaceId, user.id, body);
  return toBoardResponse(board);
}
```

Note: The import endpoint uses `POST /workspaces/:workspaceId/boards/export` — route ordering matters. Place before `:boardId` routes.

- [ ] **Step 4: Add frontend API methods**

```ts
// In boards.ts lib:
exportBoard: (workspaceId: string, boardId: string) =>
  api.post<BoardExportData>(`/workspaces/${workspaceId}/boards/${boardId}/export`),
importBoard: (workspaceId: string, data: BoardExportData) =>
  api.post<Board>(`/workspaces/${workspaceId}/boards/import`, data),
```

Add type:
```ts
export type BoardExportData = {
  board: { name: string; description: string | null };
  columns: { name: string; position: number }[];
  tasks: { title: string; description: string | null; position: number; priority: string; columnName: string }[];
};
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/boards/ apps/web/lib/boards.ts
git commit -m "feat(boards): add export/import endpoints"
```

---

### Task 6: Enhanced boards list page with search, archive/unarchive, delete

**Files:**
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/page.tsx`

- [ ] **Step 1: Add search filter state**

```tsx
const [searchQuery, setSearchQuery] = useState('');
const filteredBoards = boards.filter((b) => {
  const q = searchQuery.toLowerCase();
  return !q || b.name.toLowerCase().includes(q) || (b.description?.toLowerCase().includes(q) ?? false);
});
```

- [ ] **Step 2: Add search input above the grid**

```tsx
<input
  type="text"
  placeholder="Search boards..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  className="w-full max-w-xs rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm outline-none placeholder:text-surface-500 focus:border-primary-500"
/>
```

- [ ] **Step 3: Add archive/unarchive and delete buttons per board card**

Replace the existing board card rendering to include action buttons on hover:

```tsx
{filteredBoards.map((board) => (
  <div key={board.id} className="group relative overflow-hidden rounded-xl border border-surface-800 bg-surface-900 p-5 transition-all hover:border-surface-700">
    <Link href={`/workspaces/${workspaceId}/boards/${board.id}`}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600/20 to-emerald-600/10 text-sm font-bold text-emerald-400">
        {board.name.charAt(0).toUpperCase()}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-surface-200 group-hover:text-white">{board.name}</h3>
      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-surface-500">{board.description || 'No description'}</p>
    </Link>
    {board.archivedAt && (
      <span className="mt-3 inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">Archived</span>
    )}
    <div className="mt-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      {board.archivedAt ? (
        <button onClick={() => boardsApi.unarchive(workspaceId, board.id).then(() => loadBoards())}
          className="rounded px-2 py-1 text-[11px] text-surface-400 hover:bg-surface-800 hover:text-white">Unarchive</button>
      ) : (
        <button onClick={() => boardsApi.archive(workspaceId, board.id).then(() => loadBoards())}
          className="rounded px-2 py-1 text-[11px] text-surface-400 hover:bg-surface-800 hover:text-white">Archive</button>
      )}
      <button onClick={() => { if (confirm('Delete this board?')) boardsApi.delete(workspaceId, board.id).then(() => loadBoards()); }}
        className="rounded px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10">Delete</button>
    </div>
  </div>
))}
```

Extract the board loading logic into a `loadBoards()` function (extract from the existing `useEffect`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/workspaces/\[workspaceId\]/boards/page.tsx
git commit -m "feat(boards): add search, archive/unarchive, delete to boards list"
```

---

### Task 7: Invitation acceptance flow with selector/verifier

**Files:**
- Modify: `apps/web/app/workspaces/invitations/accept/page.tsx`

The current implementation already works but uses `token` from query params. The spec requires `selector` and `verifier` as separate query params. The backend expects `selector` + `verifier` in the body.

- [ ] **Step 1: Update to read `selector` and `verifier` from search params**

```tsx
useEffect(() => {
  const selector = searchParams.get('selector');
  const verifier = searchParams.get('verifier');

  if (!selector || !verifier) {
    setStatus('error');
    setMessage('Invalid invitation link. Missing selector or verifier.');
    return;
  }

  workspacesApi.acceptInvitation(selector, verifier)
    .then((res) => {
      setWorkspaceId(res.workspaceId);
      setStatus('success');
      setMessage(res.message || 'You are now a member of the workspace.');
    })
    .catch((err) => {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Failed to accept invitation');
    });
}, [searchParams]);
```

Also update the invitation link generation in the workspace detail page to use `selector` and `verifier` instead of `token`:

```tsx
{`${window.location.origin}/workspaces/invitations/accept?selector=${inviteToken.split(':')[0]}&verifier=${inviteToken.split(':')[1]}`}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/workspaces/invitations/accept/page.tsx apps/web/app/workspaces/\[workspaceId\]/page.tsx
git commit -m "fix(invitations): use selector/verifier query params in accept flow"
```

---

### Task 8: Workspace detail overview tab + tab route refactor

**Files:**
- Create: `apps/web/app/workspaces/[workspaceId]/_components/overview-tab.tsx`
- Create: `apps/web/app/workspaces/[workspaceId]/_components/boards-tab.tsx`
- Create: `apps/web/app/workspaces/[workspaceId]/_components/members-tab.tsx`
- Create: `apps/web/app/workspaces/[workspaceId]/_components/invitations-tab.tsx`
- Create: `apps/web/app/workspaces/[workspaceId]/_components/settings-tab.tsx`
- Modify: `apps/web/app/workspaces/[workspaceId]/page.tsx`

- [ ] **Step 1: Extract tab content into separate components**

Move each tab's JSX from `page.tsx` into its own component in `_components/`:

- `overview-tab.tsx` — NEW: analytics cards (board count from props, member count from props, task count fetched ad-hoc), recent activity feed (reuses ActivityTabContent but limited to 5 items), quick action buttons
- `boards-tab.tsx` — extract the existing boards list, update to load full board list
- `members-tab.tsx` — extract existing members code
- `invitations-tab.tsx` — extract existing invitations code
- `settings-tab.tsx` — extract existing settings code

Each component receives props:
```tsx
type TabProps = {
  workspaceId: string;
  workspace: Workspace;
  isOwner: boolean;
  currentUserId: string;
  onUpdate: () => void;
};
```

- [ ] **Step 2: Create Overview tab**

```tsx
// overview-tab.tsx
'use client';
import { useEffect, useState } from 'react';
import { workspacesApi, type AuditEvent } from '@/lib/workspaces';
import { boardsApi, type Board } from '@/lib/boards';
import { Columns, Users, ListTodo, Plus, Mail, Loader2 } from 'lucide-react';

type Props = { workspaceId: string; workspace: { name: string; id: string }; isOwner: boolean };

export function OverviewTab({ workspaceId, workspace, isOwner }: Props) {
  const [stats, setStats] = useState({ boards: 0, members: 0, tasks: 0 });
  const [recentActivity, setRecentActivity] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      workspacesApi.getActivity(workspaceId, { cursor: undefined }).then(r => setRecentActivity(r.data.slice(0, 5))),
      boardsApi.list(workspaceId).then(boards => setStats(s => ({ ...s, boards: boards.length }))),
      workspacesApi.getMembers(workspaceId).then(members => setStats(s => ({ ...s, members: members.length }))),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const cards = [
    { label: 'Boards', value: stats.boards, icon: Columns, color: 'text-emerald-400', bg: 'bg-emerald-600/10' },
    { label: 'Members', value: stats.members, icon: Users, color: 'text-blue-400', bg: 'bg-blue-600/10' },
    { label: 'Tasks', value: stats.tasks, icon: ListTodo, color: 'text-amber-400', bg: 'bg-amber-600/10' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-surface-800 bg-surface-900 p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.bg}`}>
              <c.icon size={18} className={c.color} />
            </div>
            <p className="mt-3 text-2xl font-bold">{c.value}</p>
            <p className="text-xs text-surface-500">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Link href={`/workspaces/${workspaceId}/boards`} className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-500">
          <Plus size={14} /> New board
        </Link>
        <button className="flex items-center gap-1.5 rounded-lg border border-surface-700 px-4 py-2 text-xs text-surface-300 hover:text-white">
          <Mail size={14} /> Invite members
        </button>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Recent activity</h3>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-surface-500">No activity yet</p>
        ) : (
          <div className="space-y-1">
            {recentActivity.map((e) => (
              <div key={e.id} className="flex items-start gap-3 rounded-lg border border-surface-800 bg-surface-900 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-surface-300">{e.action.replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                  <p className="text-xs text-surface-500">{new Date(e.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire tabs with `overview` as default**

Update the Tab type and default:
```tsx
type Tab = 'overview' | 'boards' | 'members' | 'invitations' | 'settings' | 'activity';
const [tab, setTab] = useState<Tab>('overview');
```

Add overview tab button:
```tsx
{ key: 'overview', label: 'Overview', icon: LayoutDashboard },
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/workspaces/\[workspaceId\]/
git commit -m "feat(workspace): extract tab components, add overview tab with analytics"
```

---

### Task 9: Members tab enhancement — role badges, bulk actions, confirmation modals

**Files:**
- Modify: `apps/web/app/workspaces/[workspaceId]/_components/members-tab.tsx`
- Modify: `apps/web/lib/workspaces.ts` (add batch role change / batch remove if needed)

- [ ] **Step 1: Add role badge colors**

```tsx
function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    ADMIN: 'bg-red-500/10 text-red-400 border-red-500/20',
    MEMBER: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    VIEWER: 'bg-surface-500/10 text-surface-400 border-surface-500/20',
    OWNER: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${styles[role] || styles.VIEWER}`}>
      {role}
    </span>
  );
}
```

- [ ] **Step 2: Add checkboxes for batch selection**

```tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const toggleSelect = (userId: string) => {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(userId)) next.delete(userId); else next.add(userId);
    return next;
  });
};
```

- [ ] **Step 3: Add batch action bar when items are selected**

```tsx
{selectedIds.size > 0 && (
  <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary-500/20 bg-primary-500/5 px-4 py-2">
    <span className="text-xs text-surface-400">{selectedIds.size} selected</span>
    <select
      onChange={async (e) => {
        const role = e.target.value;
        for (const uid of selectedIds) {
          const member = members.find((m) => m.userId === uid);
          if (member) await workspacesApi.changeMemberRole(workspaceId, uid, role);
        }
        loadMembers();
        setSelectedIds(new Set());
      }}
      className="rounded border border-surface-700 bg-surface-800 px-2 py-1 text-xs outline-none"
    >
      <option value="">Change role...</option>
      <option value="ADMIN">Admin</option>
      <option value="MEMBER">Member</option>
      <option value="VIEWER">Viewer</option>
    </select>
    <button onClick={async () => {
      if (!confirm(`Remove ${selectedIds.size} members?`)) return;
      for (const uid of selectedIds) {
        await workspacesApi.removeMember(workspaceId, uid);
      }
      loadMembers();
      setSelectedIds(new Set());
    }} className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10">
      Remove selected
    </button>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/workspaces/\[workspaceId\]/_components/members-tab.tsx
git commit -m "feat(members): add role badges, bulk selection, batch actions"
```

---

### Validation & Final Steps

- [ ] **Run typecheck**: `npm run typecheck` (or the project's equivalent — check package.json scripts)
- [ ] **Run lint**: `npm run lint`
- [ ] **Verify API compilation**: `npm run build:api` (check package.json for correct script name)
- [ ] **Run migration**: `npm run db:generate && npm run db:migrate` to apply the audit_events table

If lint/typecheck fails, fix all errors. Do not commit until all checks pass.
