# Phase 4: Board / Kanban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the board detail page into a full Kanban experience with drag-and-drop, file uploads, AI features, checklist subtasks, and improved task modal.

**Architecture:** Visual polish to board detail page, new checklist backend module, @dnd-kit for drag-and-drop, AI buttons calling existing endpoints, file upload sidebar using existing uploads service.

**Tech Stack:** NestJS, Next.js 16, React 19, Tailwind CSS v4, @dnd-kit/core, @dnd-kit/sortable, lucide-react

## Global Constraints

- `@dnd-kit/core` and `@dnd-kit/sortable` must be installed before Task 3
- Checklist DB table must be migrated via Drizzle before Task 2 backend code
- All new backend endpoints follow existing patterns: controller → service → repository with policy check
- Existing `UpdateTaskDto` already supports `dueDate` and `assigneeId` — no changes needed there
- Existing uploads controller already supports per-board file listing — no new backend endpoint needed
- Existing AI controller already has `POST /ai/boards/:boardId/summarize` and `POST /ai/ideas`
- Tailwind CSS v4 — use `@theme` tokens (`surface-*`, `primary-*`) consistently
- Dark theme only

---

### Task 1: Visual card polish

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/page.tsx`

- [ ] **Step 1: Add animation keyframes and utility classes to globals.css**

```css
@keyframes countUp {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}
.animate-countUp {
  animation: countUp 0.3s ease-out;
}

@keyframes borderGlow {
  0%, 100% { border-color: rgb(59 130 246 / 0.3); }
  50% { border-color: rgb(59 130 246 / 0.6); }
}
.animate-borderGlow {
  animation: borderGlow 1.5s ease-in-out infinite;
}
```

- [ ] **Step 2: Add column header color strip**

In the column card div, add a colored strip at the top. Use a deterministic hash of `col.name` to pick from a palette of accent colors. Render as a thin `<div>` above the column content:

```tsx
const COLUMN_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-pink-500', 'bg-lime-500',
];
const colorIndex = col.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % COLUMN_COLORS.length;
```

Insert inside the column wrapper, before the header:

```tsx
<div className={`h-1 rounded-t-xl ${COLUMN_COLORS[colorIndex]}`} />
```

- [ ] **Step 3: Priority-colored left border on task cards**

Replace the current task card with one that has a 3px left border colored by priority:

```tsx
const priorityBorder = {
  CRITICAL: 'border-l-red-500',
  HIGH: 'border-l-orange-500',
  MEDIUM: 'border-l-yellow-500',
  LOW: 'border-l-gray-500',
  NONE: 'border-l-gray-500',
}[task.priority] || 'border-l-gray-500';
```

Apply to the task card:

```tsx
className={`cursor-pointer rounded-lg border border-surface-800 border-l-4 ${priorityBorder} bg-surface-950 p-3 transition-all hover:border-surface-700 hover:-translate-y-0.5 hover:shadow-lg`}
```

- [ ] **Step 4: Empty column state**

When a column has 0 tasks, show an empty state inside the column body instead of nothing:

```tsx
{colTasks.length === 0 ? (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-800">
      <Plus size={18} className="text-surface-600" />
    </div>
    <p className="mt-2 text-xs text-surface-500">Add your first task</p>
  </div>
) : (
  colTasks.map(...)
)}
```

- [ ] **Step 5: Task count badge with animation**

Replace the static `{colTasks.length}` span with a badge that uses `animate-countUp` on change:

```tsx
<span key={colTasks.length} className="rounded-md bg-surface-800 px-2 py-0.5 text-xs text-surface-500 animate-countUp">
  {colTasks.length}
</span>
```

- [ ] **Step 6: Smooth horizontal column scroll**

Ensure the column scroll container has smooth scrolling:

```tsx
<div className="flex flex-1 gap-4 overflow-x-auto p-6 scroll-smooth">
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/globals.css apps/web/app/workspaces/*/boards/*/page.tsx
git commit -m "feat(board): visual polish - column colors, priority borders, empty state, count animation, smooth scroll"
```

---

### Task 2: Checklist backend (DB + API)

**Files:**
- Create: `packages/database/src/schema/checklists/checklist.constants.ts`
- Create: `packages/database/src/schema/checklists/checklist.schema.ts`
- Create: `packages/database/src/schema/checklists/index.ts`
- Modify: `packages/database/src/schema/index.ts`
- Create: `apps/api/src/modules/checklists/controllers/checklist.controller.ts`
- Create: `apps/api/src/modules/checklists/checklist.module.ts`
- Create: `apps/api/src/modules/checklists/dto/checklist-response.dto.ts`
- Create: `apps/api/src/modules/checklists/dto/create-checklist.dto.ts`
- Create: `apps/api/src/modules/checklists/dto/update-checklist.dto.ts`
- Create: `apps/api/src/modules/checklists/errors/checklist.errors.ts`
- Create: `apps/api/src/modules/checklists/policies/checklist.policy.ts`
- Create: `apps/api/src/modules/checklists/repositories/checklist.repository.ts`
- Create: `apps/api/src/modules/checklists/services/checklist.service.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create DB schema files**

`packages/database/src/schema/checklists/checklist.constants.ts`:

```ts
export const checklistItemsTableName = 'checklist_items';
export const checklistAlias = 'checklist_items';
export const CHECKLIST_TEXT_MAX_LENGTH = 500;
export const CHECKLIST_TEXT_MIN_LENGTH = 1;
```

`packages/database/src/schema/checklists/checklist.schema.ts`:

```ts
import { boolean, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { CREATED_AT, PRIMARY_ID, UPDATED_AT } from '../common.js';
import { tasks } from '../tasks/task.schema.js';
import { checklistAlias, checklistItemsTableName } from './checklist.constants.js';

export const checklistItems = pgTable(
  checklistItemsTableName,
  {
    id: PRIMARY_ID(),
    taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    completed: boolean('completed').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
  },
  (table) => ({
    checklistTaskIdx: index('checklist_task_idx').on(table.taskId),
  }),
);

export type ChecklistItemRow = typeof checklistItems.$inferSelect;
export type NewChecklistItemRow = typeof checklistItems.$inferInsert;

export const checklistAccess = {
  table: checklistItems,
  alias: checklistAlias,
};
```

`packages/database/src/schema/checklists/index.ts`:

```ts
export * from './checklist.constants.js';
export * from './checklist.schema.js';
```

Register the module in `packages/database/src/schema/index.ts`:

```ts
export * from './checklists/index.js';
```

Run migration generation:

```bash
cd packages/database && npx drizzle-kit generate
```

- [ ] **Step 2: Create NestJS module**

`apps/api/src/modules/checklists/checklist.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ChecklistController } from './controllers/checklist.controller';
import { ChecklistService } from './services/checklist.service';
import { ChecklistRepository } from './repositories/checklist.repository';
import { ChecklistPolicy } from './policies/checklist.policy';

@Module({
  controllers: [ChecklistController],
  providers: [ChecklistService, ChecklistRepository, ChecklistPolicy],
  exports: [ChecklistService],
})
export class ChecklistModule {}
```

- [ ] **Step 3: Create DTOs**

`checklist-response.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';

export class ChecklistItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() taskId!: string;
  @ApiProperty() text!: string;
  @ApiProperty() completed!: boolean;
  @ApiProperty() position!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
```

`create-checklist.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CHECKLIST_TEXT_MAX_LENGTH, CHECKLIST_TEXT_MIN_LENGTH } from '@repo/database';

export class CreateChecklistDto {
  @ApiProperty()
  @IsString()
  @MinLength(CHECKLIST_TEXT_MIN_LENGTH)
  @MaxLength(CHECKLIST_TEXT_MAX_LENGTH)
  text!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  position?: number;
}
```

`update-checklist.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CHECKLIST_TEXT_MAX_LENGTH, CHECKLIST_TEXT_MIN_LENGTH } from '@repo/database';

export class UpdateChecklistDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(CHECKLIST_TEXT_MIN_LENGTH)
  @MaxLength(CHECKLIST_TEXT_MAX_LENGTH)
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  position?: number;
}
```

- [ ] **Step 4: Create errors**

`checklist.errors.ts` — follow pattern from `tasks.errors.ts`:

```ts
export const ChecklistErrorCode = {
  ITEM_NOT_FOUND: 'CHECKLIST.ITEM_NOT_FOUND',
} as const;

export class ChecklistException extends HttpException { /* ... */ }
```

- [ ] **Step 5: Create policy, repository, service**

`checklist.policy.ts` — reuses `TasksPolicy` logic or a simple member check.

`checklist.repository.ts` — CRUD for `checklistItems` table.

`checklist.service.ts`:

- `listByTask(taskId, userId)` — fetch all items for a task, ordered by position
- `create(taskId, userId, dto)` — create item for task
- `update(itemId, userId, dto)` — update text/completed/position
- `delete(itemId, userId)` — delete item

- [ ] **Step 6: Create controller**

`checklist.controller.ts` — routes under `/workspaces/:workspaceId/boards/:boardId/tasks/:taskId/checklist`:

- `GET :taskId/checklist` — list items
- `POST :taskId/checklist` — create item
- `PATCH checklist/:itemId` — update item
- `DELETE checklist/:itemId` — delete item

- [ ] **Step 7: Register ChecklistModule in root app module**

Add `ChecklistModule` to `apps/api/src/app.module.ts` imports.

- [ ] **Step 8: Create frontend API client**

Create `apps/web/lib/checklist.ts`:

```ts
import { api } from './api';

export type ChecklistItem = {
  id: string;
  taskId: string;
  text: string;
  completed: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export const checklistApi = {
  list: (workspaceId: string, boardId: string, taskId: string) =>
    api.get<ChecklistItem[]>(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/checklist`),
  create: (workspaceId: string, boardId: string, taskId: string, data: { text: string; position?: number }) =>
    api.post<ChecklistItem>(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/checklist`, data),
  update: (workspaceId: string, boardId: string, taskId: string, itemId: string, data: { text?: string; completed?: boolean; position?: number }) =>
    api.patch<ChecklistItem>(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/checklist/${itemId}`, data),
  delete: (workspaceId: string, boardId: string, taskId: string, itemId: string) =>
    api.delete<void>(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/checklist/${itemId}`),
};
```

- [ ] **Step 9: Add board templates endpoint**

Modify `apps/api/src/modules/boards/controllers/boards.controller.ts` — add:

```ts
@Post('templates')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Create board from template' })
public async createFromTemplate(
  @CurrentUser() user: CurrentUserModel,
  @Param('workspaceId') workspaceId: string,
  @Body() body: CreateBoardFromTemplateDto,
): Promise<BoardResponseDto> {
  return this.boards.createFromTemplate(workspaceId, user.id, body);
}
```

Create `apps/api/src/modules/boards/dto/create-board-template.dto.ts`:

```ts
export class CreateBoardFromTemplateDto {
  name!: string;
  template!: 'SPRINT' | 'PROJECT' | 'PERSONAL';
}
```

Add `createFromTemplate` method to `boards.service.ts` — creates the board with pre-configured columns based on the template:
- SPRINT: To Do, In Progress, In Review, Done
- PROJECT: Backlog, To Do, In Progress, Done
- PERSONAL: To Do, Doing, Done

- [ ] **Step 10: Commit**

```bash
git add packages/database/src/schema/checklists/ apps/api/src/modules/checklists/ apps/web/lib/checklist.ts apps/api/src/modules/boards/
git commit -m "feat(api): add checklist backend (DB, CRUD endpoints) and board templates"
```

---

### Task 3: Drag & drop

**Files:**
- Modify: `apps/web/package.json` (add dependencies)
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/page.tsx`

- [ ] **Step 1: Install @dnd-kit**

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities --filter web
```

- [ ] **Step 2: Add DndContext wrapping the board columns area**

Import:

```tsx
import {
  DndContext, DragOverlay, closestCorners, KeyboardSensor,
  PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'; // if available, else skip
```

Wrap the column scroll area with `<DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>`.

- [ ] **Step 3: Implement task card dragging**

Create a `SortableTaskCard` component that wraps each task card with `useSortable`:

```tsx
function SortableTaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick} className="...">
      {/* same card content as before */}
    </div>
  );
}
```

Replace the plain `<div key={task.id} onClick={...}>` with `<SortableTaskCard>`.

- [ ] **Step 4: Implement column-level sorting**

Wrap each column in a `SortableContext` with `verticalListSortingStrategy`. Each column container is its own sortable context for tasks.

- [ ] **Step 5: Handle drag end for tasks**

```tsx
const [activeId, setActiveId] = useState<string | null>(null);

function handleDragStart(event: DragStartEvent) {
  setActiveId(event.active.id as string);
}

async function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) { setActiveId(null); return; }

  const activeTask = tasks.find(t => t.id === active.id);
  const overTask = tasks.find(t => t.id === over.id);

  if (!activeTask) { setActiveId(null); return; }

  // Same column — reorder
  if (activeTask.columnId === overTask?.columnId) {
    const colTasks = tasks.filter(t => t.columnId === activeTask.columnId).sort((a, b) => a.position - b.position);
    const oldIdx = colTasks.findIndex(t => t.id === active.id);
    const newIdx = colTasks.findIndex(t => t.id === over.id);
    if (oldIdx === newIdx) { setActiveId(null); return; }
    const reordered = arrayMove(colTasks, oldIdx, newIdx);
    setTasks(prev => prev.map(t => {
      const found = reordered.find(r => r.id === t.id);
      return found ? { ...t, position: found.position } : t;
    }));
    // Optimistic — patch position
    await tasksApi.move(workspaceId, boardId, active.id as string, { columnId: activeTask.columnId, position: newIdx });
  } else {
    // Move to different column
    const targetColumnId = overTask ? overTask.columnId : (over.id as string);
    const targetTasks = tasks.filter(t => t.columnId === targetColumnId);
    const newPosition = targetTasks.length;
    setTasks(prev => prev.map(t => t.id === active.id ? { ...t, columnId: targetColumnId, position: newPosition } : t));
    await tasksApi.move(workspaceId, boardId, active.id as string, { columnId: targetColumnId, position: newPosition });
  }

  setActiveId(null);
}
```

- [ ] **Step 6: Add column header drag for reordering columns**

Wrap the column header in `useSortable` with `id={col.id}`. Use a separate `DndContext` or reuse with ID prefixing. On drag end for columns, call `boardsApi.updateColumn(workspaceId, boardId, colId, { position: newPos })`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/app/workspaces/*/boards/*/page.tsx
git commit -m "feat(board): add drag-and-drop for tasks (within/across columns) and column reorder"
```

---

### Task 4: File uploads

**Files:**
- Create: `apps/web/components/board-upload-button.tsx`
- Create: `apps/web/components/board-file-sidebar.tsx`
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/page.tsx`

- [ ] **Step 1: Create upload button component**

`board-upload-button.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { uploadsApi } from '@/lib/uploads';

type Props = {
  workspaceId: string;
  boardId: string;
  onUploaded: () => void;
};

export function BoardUploadButton({ workspaceId, boardId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadsApi.upload(workspaceId, file, boardId);
      onUploaded();
    } catch { /* handled */ }
    finally { setUploading(false); }
  }

  return (
    <>
      <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
      >
        <Upload size={14} />
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
    </>
  );
}
```

- [ ] **Step 2: Create uploads API client (`apps/web/lib/uploads.ts`)**

```ts
import { api } from './api';

export type UploadedFile = {
  id: string;
  workspaceId: string;
  boardId: string | null;
  userId: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  provider: string;
  createdAt: string;
};

export const uploadsApi = {
  upload: async (workspaceId: string, file: File, boardId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (boardId) formData.append('boardId', boardId);
    return api.post<UploadedFile>(`/workspaces/${workspaceId}/uploads`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  listByBoard: (workspaceId: string, boardId: string) =>
    api.get<UploadedFile[]>(`/workspaces/${workspaceId}/uploads/boards/${boardId}`),
  delete: (workspaceId: string, uploadId: string) =>
    api.delete<void>(`/workspaces/${workspaceId}/uploads/${uploadId}`),
};
```

- [ ] **Step 3: Create file sidebar component**

`board-file-sidebar.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { FileText, Trash2, X } from 'lucide-react';
import { uploadsApi, type UploadedFile } from '@/lib/uploads';
import { formatFileSize } from '@/lib/utils'; // inline helper

type Props = {
  workspaceId: string;
  boardId: string;
  onClose: () => void;
};

export function BoardFileSidebar({ workspaceId, boardId, onClose }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    uploadsApi.listByBoard(workspaceId, boardId)
      .then(setFiles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [workspaceId, boardId]);

  async function handleDelete(fileId: string) {
    try {
      await uploadsApi.delete(workspaceId, fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch { /* handled */ }
  }

  return (
    <div className="w-72 shrink-0 border-l border-surface-800 bg-surface-900">
      <div className="flex items-center justify-between border-b border-surface-800 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-400">Files</h3>
        <button onClick={onClose} className="text-surface-500 hover:text-surface-300">
          <X size={14} />
        </button>
      </div>
      <div className="space-y-1 p-3">
        {files.map(f => (
          <div key={f.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-surface-800">
            <FileText size={12} className="shrink-0 text-surface-500" />
            <a href={f.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-surface-300 hover:text-white">
              {f.originalName}
            </a>
            <span className="shrink-0 text-surface-500">{formatFileSize(f.size)}</span>
            <button onClick={() => handleDelete(f.id)} className="shrink-0 text-surface-500 hover:text-red-400">
              <Trash2 size={10} />
            </button>
          </div>
        ))}
        {!loading && files.length === 0 && (
          <p className="py-4 text-center text-xs text-surface-500">No files uploaded</p>
        )}
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
```

- [ ] **Step 4: Wire into board header**

Add Upload button next to Canvas button in the board page header. Add a toggleable file sidebar similar to how comments sidebar works:

```tsx
const [showFiles, setShowFiles] = useState(false);

// In header, next to other buttons:
<BoardUploadButton workspaceId={workspaceId} boardId={boardId} onUploaded={() => setShowFiles(true)} />
<button
  onClick={() => setShowFiles(!showFiles)}
  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
    showFiles ? 'bg-primary-600/20 text-primary-400' : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
  }`}
>
  <FileText size={14} />
  Files
</button>

// In the flex container alongside CommentsPanel:
{showFiles && (
  <BoardFileSidebar workspaceId={workspaceId} boardId={boardId} onClose={() => setShowFiles(false)} />
)}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/uploads.ts apps/web/components/board-upload-button.tsx apps/web/components/board-file-sidebar.tsx apps/web/app/workspaces/*/boards/*/page.tsx
git commit -m "feat(board): add file upload button and toggleable file sidebar"
```

---

### Task 5: AI features

**Files:**
- Create: `apps/web/components/ai-summarize-panel.tsx`
- Create: `apps/web/components/ai-ideas-dialog.tsx`
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/page.tsx`

- [ ] **Step 1: Create AI API client (`apps/web/lib/ai.ts`)**

```ts
import { api } from './api';

export const aiApi = {
  summarizeBoard: (boardId: string) =>
    api.post<{ summary: string }>(`/ai/boards/${boardId}/summarize`),
  generateIdeas: (topic: string, count = 4) =>
    api.post<{ ideas: { text: string; priority?: string }[] }>('/ai/ideas', { topic, count }),
};
```

- [ ] **Step 2: Create summarize panel component**

`ai-summarize-panel.tsx` — a slide-over panel that shows when the Summarize button is clicked:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { aiApi } from '@/lib/ai';

type Props = {
  boardId: string;
  onClose: () => void;
};

export function AiSummarizePanel({ boardId, onClose }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    aiApi.summarizeBoard(boardId)
      .then(r => setSummary(r.summary))
      .catch(() => setSummary('Failed to generate summary.'))
      .finally(() => setLoading(false));
  }, [boardId]);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 border-l border-surface-800 bg-surface-900 shadow-2xl animate-slideIn">
      <div className="flex items-center justify-between border-b border-surface-800 px-6 py-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary-400" />
          <h2 className="text-sm font-semibold">AI Summary</h2>
        </div>
        <button onClick={onClose} className="text-surface-500 hover:text-surface-300">
          <X size={16} />
        </button>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-primary-500" />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-surface-300">{summary}</p>
        )}
      </div>
    </div>
  );
}
```

Add `animate-slideIn` to globals.css:

```css
@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
.animate-slideIn {
  animation: slideIn 0.2s ease-out;
}
```

- [ ] **Step 3: Create Generate Ideas dialog**

`ai-ideas-dialog.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Sparkles, X, Loader2, Plus } from 'lucide-react';
import { aiApi } from '@/lib/ai';

type Props = {
  onClose: () => void;
  onCreateIdea: (title: string) => void;
};

export function AiIdeasDialog({ onClose, onCreateIdea }: Props) {
  const [topic, setTopic] = useState('');
  const [ideas, setIdeas] = useState<{ text: string; priority?: string }[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const result = await aiApi.generateIdeas(topic.trim());
      setIdeas(result.ideas);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-surface-800 bg-surface-900 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-surface-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary-400" />
            <h2 className="text-sm font-semibold">Generate Ideas</h2>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300"><X size={16} /></button>
        </div>
        <div className="space-y-4 p-6">
          <div className="flex gap-2">
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Enter a topic..."
              className="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm outline-none focus:border-primary-500"
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            />
            <button onClick={handleGenerate} disabled={loading || !topic.trim()} className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-500 disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : 'Generate'}
            </button>
          </div>
          {ideas && (
            <div className="space-y-2">
              {ideas.map((idea, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-950 p-3">
                  <p className="text-sm text-surface-300">{idea.text}</p>
                  <button onClick={() => { onCreateIdea(idea.text); onClose(); }} className="rounded p-1 text-surface-500 hover:text-primary-400">
                    <Plus size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire AI buttons into board header**

Add to the header action buttons:

```tsx
const [showSummary, setShowSummary] = useState(false);
const [showIdeas, setShowIdeas] = useState(false);

<button onClick={() => setShowSummary(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200">
  <Sparkles size={14} />
  Summarize
</button>
<button onClick={() => setShowIdeas(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200">
  <Lightbulb size={14} />
  Ideas
</button>
```

Render panels conditionally:

```tsx
{showSummary && <AiSummarizePanel boardId={boardId} onClose={() => setShowSummary(false)} />}
{showIdeas && <AiIdeasDialog onClose={() => setShowIdeas(false)} onCreateIdea={(title) => { /* open create modal with prefilled title */ }} />}
```

Add `Lightbulb` to lucide-react imports.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/ai.ts apps/web/components/ai-summarize-panel.tsx apps/web/components/ai-ideas-dialog.tsx apps/web/app/globals.css apps/web/app/workspaces/*/boards/*/page.tsx
git commit -m "feat(board): add AI summarize panel and generate ideas dialog"
```

---

### Task 6: Task modal improvements

**Files:**
- Modify: `apps/web/components/task-modal.tsx`
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/page.tsx`

- [ ] **Step 1: Replace assignee text input with user search picker**

Replace the Assignee ID text input with a search-and-select user picker:

```tsx
import { useEffect, useState, useRef } from 'react';
import { usersApi, type UserProfile } from '@/lib/users';
import { Check, ChevronDown, Search } from 'lucide-react';

// In the modal:
const [userSearch, setUserSearch] = useState('');
const [users, setUsers] = useState<UserProfile[]>([]);
const [showUserDropdown, setShowUserDropdown] = useState(false);
const userRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  usersApi.list({ limit: 50 }).then(r => setUsers(r.users)).catch(() => {});
}, []);

// Click outside to close dropdown
useEffect(() => {
  function handler(e: MouseEvent) {
    if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUserDropdown(false);
  }
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, []);
```

Replace the assignee field with:

```tsx
<div ref={userRef} className="relative">
  <label className="block text-xs font-medium mb-1 text-surface-400">Assignee</label>
  <button
    type="button"
    onClick={() => setShowUserDropdown(!showUserDropdown)}
    className="flex w-full items-center justify-between rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm"
  >
    <span className={assigneeId ? 'text-white' : 'text-surface-500'}>
      {assigneeId ? users.find(u => u.id === assigneeId)?.displayName || assigneeId : 'Unassigned'}
    </span>
    <ChevronDown size={14} className="text-surface-500" />
  </button>
  {showUserDropdown && (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-surface-800 bg-surface-900 shadow-xl">
      <div className="border-b border-surface-800 p-2">
        <input
          value={userSearch}
          onChange={e => setUserSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full rounded-md bg-surface-800 px-2 py-1 text-xs outline-none"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        <button
          type="button"
          onClick={() => { setAssigneeId(''); setShowUserDropdown(false); }}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-surface-400 hover:bg-surface-800"
        >
          Unassigned
        </button>
        {users
          .filter(u => !userSearch || u.displayName.toLowerCase().includes(userSearch.toLowerCase()))
          .map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => { setAssigneeId(u.id); setShowUserDropdown(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-surface-800"
            >
              <span className="flex-1 text-left">{u.displayName}</span>
              {u.id === assigneeId && <Check size={12} className="text-primary-400" />}
            </button>
          ))}
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 2: Add due date picker**

Add after the assignee field:

```tsx
<div>
  <label className="block text-xs font-medium mb-1 text-surface-400">Due date</label>
  <input
    type="date"
    value={dueDate ? dueDate.split('T')[0] : ''}
    onChange={(e) => setDueDate(e.target.value ? new Date(e.target.value).toISOString() : '')}
    className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm outline-none focus:border-primary-500"
  />
</div>
```

Add `dueDate` to modal state:

```tsx
const [dueDate, setDueDate] = useState(task?.dueDate || '');
```

Pass `dueDate` in the create/update payload:

```tsx
// Create: include dueDate if set
const data: CreateTaskData = {
  title: title.trim(),
  description: description.trim() || undefined,
  priority,
  assigneeId: assigneeId || undefined,
  ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
};

// Update:
const updated = await tasksApi.update(workspaceId, boardId, task.id, {
  title: title.trim(),
  description: description.trim() || null,
  priority,
  assigneeId: assigneeId || null,
  dueDate: dueDate ? new Date(dueDate).toISOString() : null,
});
```

- [ ] **Step 3: Show comments count on task card**

Fetch or derive comments count per task. Since the existing comments endpoint lists by board, derive counts client-side. Add a comments count display on the task card:

```tsx
// On the task card, after priority badge:
{/* comments count - passed via a new prop or derived */}
{task.commentCount > 0 && (
  <span className="flex items-center gap-1 text-xs text-surface-500">
    <MessageSquare size={10} />
    {task.commentCount}
  </span>
)}
```

To support this, add `commentCount` to the Task type and pass it from the board page. Load comment counts when tasks load:

```tsx
// In loadBoard, after fetching tasks:
const boardComments = await commentsApi.list(boardId);
const commentCountMap = new Map<string, number>();
boardComments.forEach(c => {
  commentCountMap.set(c.boardId, (commentCountMap.get(c.boardId) || 0) + 1);
});
setTasks(tsks.map(t => ({ ...t, commentCount: commentCountMap.get(t.id) || 0 })));
```

- [ ] **Step 4: Add checklist UI in task modal**

Inside the task modal, add a checklist section that loads when editing a task:

```tsx
import { checklistApi, type ChecklistItem } from '@/lib/checklist';

const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
const [checklistLoading, setChecklistLoading] = useState(false);
const [newChecklistText, setNewChecklistText] = useState('');

useEffect(() => {
  if (mode === 'edit' && task) {
    setChecklistLoading(true);
    checklistApi.list(workspaceId, boardId, task.id)
      .then(setChecklist)
      .catch(() => {})
      .finally(() => setChecklistLoading(false));
  }
}, [mode, task, workspaceId, boardId]);

async function handleAddChecklistItem() {
  if (!newChecklistText.trim() || !task) return;
  const item = await checklistApi.create(workspaceId, boardId, task.id, { text: newChecklistText.trim() });
  setChecklist(prev => [...prev, item]);
  setNewChecklistText('');
}

async function handleToggleChecklistItem(item: ChecklistItem) {
  const updated = await checklistApi.update(workspaceId, boardId, task.id, item.id, { completed: !item.completed });
  setChecklist(prev => prev.map(i => i.id === item.id ? updated : i));
}

async function handleDeleteChecklistItem(itemId: string) {
  await checklistApi.delete(workspaceId, boardId, task.id, itemId);
  setChecklist(prev => prev.filter(i => i.id !== itemId));
}
```

Render the checklist section in the modal:

```tsx
{mode === 'edit' && (
  <div>
    <label className="block text-xs font-medium mb-2 text-surface-400">Checklist</label>
    {checklistLoading ? (
      <p className="text-xs text-surface-500">Loading...</p>
    ) : (
      <div className="space-y-1">
        {checklist.map(item => (
          <div key={item.id} className="flex items-center gap-2 rounded-lg bg-surface-800/50 px-3 py-1.5">
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => handleToggleChecklistItem(item)}
              className="rounded border-surface-600 bg-surface-700 accent-primary-500"
            />
            <span className={`flex-1 text-sm ${item.completed ? 'text-surface-500 line-through' : 'text-surface-300'}`}>
              {item.text}
            </span>
            <button onClick={() => handleDeleteChecklistItem(item.id)} className="text-surface-500 hover:text-red-400">
              <X size={12} />
            </button>
          </div>
        ))}
        <div className="flex gap-1">
          <input
            value={newChecklistText}
            onChange={e => setNewChecklistText(e.target.value)}
            placeholder="Add item..."
            className="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-2.5 py-1.5 text-xs outline-none focus:border-primary-500"
            onKeyDown={e => e.key === 'Enter' && handleAddChecklistItem()}
          />
          <button onClick={handleAddChecklistItem} className="rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-500">
            Add
          </button>
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Add filter & search bar to board header**

In the board page, add a filter bar between the header and the columns:

```tsx
const [searchQuery, setSearchQuery] = useState('');
const [filterPriority, setFilterPriority] = useState<string>('');
const [filterAssignee, setFilterAssignee] = useState<string>('');

// Derived filtered tasks:
const filteredTasks = tasks.filter(t => {
  if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
  if (filterPriority && t.priority !== filterPriority) return false;
  if (filterAssignee && t.assigneeId !== filterAssignee) return false;
  return true;
});

// In the render, use filteredTasks instead of tasks when building columns
```

Add a filter bar UI after the header:

```tsx
<div className="flex items-center gap-2 border-b border-surface-800 px-8 py-3">
  <Search size={14} className="text-surface-500" />
  <input
    value={searchQuery}
    onChange={e => setSearchQuery(e.target.value)}
    placeholder="Search tasks..."
    className="flex-1 bg-transparent text-xs outline-none placeholder:text-surface-600"
  />
  <select
    value={filterPriority}
    onChange={e => setFilterPriority(e.target.value)}
    className="rounded-md border border-surface-800 bg-surface-900 px-2 py-1 text-xs outline-none"
  >
    <option value="">All priorities</option>
    <option value="CRITICAL">Critical</option>
    <option value="HIGH">High</option>
    <option value="MEDIUM">Medium</option>
    <option value="LOW">Low</option>
    <option value="NONE">None</option>
  </select>
  <select
    value={filterAssignee}
    onChange={e => setFilterAssignee(e.target.value)}
    className="rounded-md border border-surface-800 bg-surface-900 px-2 py-1 text-xs outline-none"
  >
    <option value="">All assignees</option>
    {users.map(u => (
      <option key={u.id} value={u.id}>{u.displayName}</option>
    ))}
  </select>
</div>
```

- [ ] **Step 6: Board templates on create**

Modify the board list page `apps/web/app/workspaces/[workspaceId]/boards/page.tsx` to offer template selection when creating:

```tsx
const [selectedTemplate, setSelectedTemplate] = useState<'SPRINT' | 'PROJECT' | 'PERSONAL' | null>(null);

// Add template cards in the create form:
<div className="flex gap-2">
  {(['SPRINT', 'PROJECT', 'PERSONAL'] as const).map(t => (
    <button
      key={t}
      type="button"
      onClick={() => setSelectedTemplate(t)}
      className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
        selectedTemplate === t ? 'border-primary-500 bg-primary-600/20 text-primary-400' : 'border-surface-700 text-surface-400 hover:border-surface-600'
      }`}
    >
      {t === 'SPRINT' ? 'Sprint' : t === 'PROJECT' ? 'Project' : 'Personal'}
    </button>
  ))}
</div>
```

Send template when creating:

```tsx
const board = await boardsApi.create(workspaceId, { name, template: selectedTemplate || undefined });
```

Add `template` to the `CreateBoardDto` on the backend (optional, defaults to the current 3-column setup).

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/task-modal.tsx apps/web/app/workspaces/*/boards/*/page.tsx apps/web/app/workspaces/*/boards/page.tsx
git commit -m "feat(board): task modal improvements - user picker, due date, checklist UI, filter bar, board templates"
```

---

### Verification

- [ ] **Run type checking**

```bash
pnpm -F web check-types
pnpm -F api check-types
```

- [ ] **Run linting**

```bash
pnpm -F web lint
pnpm -F api lint
```

- [ ] **Run backend tests**

```bash
pnpm -F api test
```

- [ ] **Run database migration check**

```bash
cd packages/database && npx drizzle-kit check
```
