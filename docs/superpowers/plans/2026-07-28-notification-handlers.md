# Notification Event Handlers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the notifications module to subscribe to domain events from all other modules and automatically create + deliver notifications.

**Architecture:** Single `NotificationHandler` class subscribing to 5 event buses in `onModuleInit()`, mapping each event to `NotificationsService.createAndDeliver()` calls with resolved target user IDs.

**Tech Stack:** NestJS, Node EventEmitter (existing pattern), Drizzle ORM

## Global Constraints

- Follow existing module structure (no new imports into common/ or shared layers)
- Use direct repository injection (same pattern as canvas & uploads modules)
- TaskCreatedPayload gets `assigneeId?: string` added (existing controller already accepts it)
- Notification types come from existing `notificationTypeEnum` in `@repo/database`
- Run `pnpm run build && pnpm run check-types && pnpm run lint && pnpm --filter api run test` before finish

---

### Task 1: Add FILE_UPLOADED to notification enum + create migration 0003

**Files:**
- Modify: `packages/database/src/schema/enums/notification.enums.ts:3-11`
- Create: `packages/database/src/migrations/0003_*.sql`

- [ ] **Step 1: Add FILE_UPLOADED to the enum**

In `packages/database/src/schema/enums/notification.enums.ts`, add `'FILE_UPLOADED'` to the `notificationTypeEnum` array:

```ts
export const notificationTypeEnum = pgEnum('notification_type', [
  'COMMENT_ADDED',
  'BOARD_SHARED',
  'WORKSPACE_UPDATED',
  'MENTION_CREATED',
  'MEMBER_ADDED',
  'INVITATION_ACCEPTED',
  'TASK_ASSIGNED',
  'FILE_UPLOADED',
]);
```

- [ ] **Step 2: Generate migration**

```bash
pnpm --filter database run generate
```

- [ ] **Step 3: Verify migration file exists**

Check that `packages/database/src/migrations/0003_*.sql` was created.

- [ ] **Step 4: Commit**

```bash
git add packages/database/src/schema/enums/notification.enums.ts packages/database/src/migrations/0003_*.sql
git commit -m "feat(db): add FILE_UPLOADED notification type"
```

---

### Task 2: Extend TaskCreatedPayload with assigneeId

**Files:**
- Modify: `apps/api/src/modules/tasks/events/tasks.events.ts:4-9`
- Modify: `apps/api/src/modules/tasks/services/tasks.service.ts:66-71`

- [ ] **Step 1: Add assigneeId to TaskCreatedPayload**

```ts
export type TaskCreatedPayload = {
  taskId: string;
  boardId: string;
  columnId: string;
  createdBy: string;
  assigneeId?: string;
};
```

- [ ] **Step 2: Update publish call in tasks.service.ts**

```ts
this.events.publishTaskCreated({
  taskId: task.id,
  boardId,
  columnId,
  createdBy: userId,
  assigneeId: task.assigneeId ?? undefined,
});
```

- [ ] **Step 3: Run type check**

```bash
pnpm run check-types
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/tasks/events/tasks.events.ts apps/api/src/modules/tasks/services/tasks.service.ts
git commit -m "feat(tasks): add assigneeId to TaskCreatedPayload"
```

---

### Task 3: Create NotificationPolicy

**Files:**
- Create: `apps/api/src/modules/notifications/policies/notification.policy.ts`

- [ ] **Step 1: Create the policy file**

```ts
import { Injectable } from '@nestjs/common';
import { NotificationsRepository } from '../repositories/notifications.repository';

@Injectable()
export class NotificationPolicy {
  constructor(
    private readonly notificationsRepo: NotificationsRepository,
  ) {}

  public async canRead(
    notificationId: string,
    userId: string,
  ): Promise<boolean> {
    const notification = await this.notificationsRepo.findById(notificationId, userId);
    return !!notification;
  }

  public async canArchive(
    notificationId: string,
    userId: string,
  ): Promise<boolean> {
    return this.canRead(notificationId, userId);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/notifications/policies/notification.policy.ts
git commit -m "feat(notifications): add NotificationPolicy"
```

---

### Task 4: Create NotificationHandler

**Files:**
- Create: `apps/api/src/modules/notifications/handlers/notification.handler.ts`

- [ ] **Step 1: Create the handler**

```ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import type { BoardCreatedPayload } from '../../boards/events/boards.events';
import { BoardsEventBus } from '../../boards/events/boards.events';
import type { CommentCreatedPayload } from '../../comments/events/comments.events';
import { CommentsEventBus } from '../../comments/events/comments.events';
import type { TaskCreatedPayload } from '../../tasks/events/tasks.events';
import { TasksEventBus } from '../../tasks/events/tasks.events';
import type { MemberAddedPayload, InvitationAcceptedPayload } from '../../workspaces/events/workspaces.events';
import { WorkspacesEventBus } from '../../workspaces/events/workspaces.events';
import type { FileUploadedPayload } from '../../uploads/events/uploads.events';
import { UploadsEventBus } from '../../uploads/events/uploads.events';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';
import { BoardsRepository } from '../../boards/repositories/boards.repository';

import { NotificationsService } from '../services/notifications.service';

@Injectable()
export class NotificationHandler implements OnModuleInit {
  private readonly logger = new Logger(NotificationHandler.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly boardsEventBus: BoardsEventBus,
    private readonly commentsEventBus: CommentsEventBus,
    private readonly tasksEventBus: TasksEventBus,
    private readonly workspacesEventBus: WorkspacesEventBus,
    private readonly uploadsEventBus: UploadsEventBus,
    private readonly workspaceMembersRepo: WorkspaceMembersRepository,
    private readonly boardsRepo: BoardsRepository,
  ) {}

  public onModuleInit(): void {
    this.boardsEventBus.onBoardCreated((p) => this.handleBoardCreated(p));
    this.boardsEventBus.onBoardArchived((p) => this.handleBoardArchived(p));
    this.commentsEventBus.onCommentCreated((p) => this.handleCommentCreated(p));
    this.tasksEventBus.onTaskCreated((p) => this.handleTaskCreated(p));
    this.workspacesEventBus.onMemberAdded((p) => this.handleMemberAdded(p));
    this.workspacesEventBus.onInvitationAccepted((p) => this.handleInvitationAccepted(p));
    this.uploadsEventBus.onFileUploaded((p) => this.handleFileUploaded(p));
    this.logger.log('Notification handlers registered');
  }

  private async handleBoardCreated(payload: BoardCreatedPayload): Promise<void> {
    try {
      const members = await this.workspaceMembersRepo.listByWorkspace(payload.workspaceId);
      for (const m of members) {
        await this.notifications.createAndDeliver(m.userId, {
          type: 'BOARD_SHARED',
          title: 'New board created',
          body: undefined,
          resourceType: 'board',
          resourceId: payload.boardId,
        });
      }
    } catch (err) {
      this.logger.error('Failed to handle BoardCreated', err);
    }
  }

  private async handleBoardArchived(payload: { boardId: string; archivedBy: string }): Promise<void> {
    try {
      const board = await this.boardsRepo.findById(payload.boardId);
      if (!board) return;
      const members = await this.workspaceMembersRepo.listByWorkspace(board.workspaceId);
      for (const m of members) {
        if (m.userId === payload.archivedBy) continue;
        await this.notifications.createAndDeliver(m.userId, {
          type: 'BOARD_SHARED',
          title: 'Board archived',
          body: undefined,
          resourceType: 'board',
          resourceId: payload.boardId,
        });
      }
    } catch (err) {
      this.logger.error('Failed to handle BoardArchived', err);
    }
  }

  private async handleCommentCreated(payload: CommentCreatedPayload): Promise<void> {
    try {
      const board = await this.boardsRepo.findById(payload.boardId);
      if (!board) return;
      const members = await this.workspaceMembersRepo.listByWorkspace(board.workspaceId);
      for (const m of members) {
        if (m.userId === payload.userId) continue;
        await this.notifications.createAndDeliver(m.userId, {
          type: 'COMMENT_ADDED',
          title: 'New comment on board',
          body: undefined,
          resourceType: 'board',
          resourceId: payload.boardId,
        });
      }
    } catch (err) {
      this.logger.error('Failed to handle CommentCreated', err);
    }
  }

  private async handleTaskCreated(payload: TaskCreatedPayload): Promise<void> {
    if (!payload.assigneeId) return;
    try {
      await this.notifications.createAndDeliver(payload.assigneeId, {
        type: 'TASK_ASSIGNED',
        title: 'You were assigned a task',
        body: undefined,
        resourceType: 'task',
        resourceId: payload.taskId,
      });
    } catch (err) {
      this.logger.error('Failed to handle TaskCreated', err);
    }
  }

  private async handleMemberAdded(payload: MemberAddedPayload): Promise<void> {
    try {
      await this.notifications.createAndDeliver(payload.userId, {
        type: 'MEMBER_ADDED',
        title: 'You were added to a workspace',
        body: undefined,
        resourceType: 'workspace',
        resourceId: payload.workspaceId,
      });
    } catch (err) {
      this.logger.error('Failed to handle MemberAdded', err);
    }
  }

  private async handleInvitationAccepted(payload: InvitationAcceptedPayload): Promise<void> {
    try {
      const members = await this.workspaceMembersRepo.listByWorkspace(payload.workspaceId);
      for (const m of members) {
        if (m.userId === payload.userId) continue;
        await this.notifications.createAndDeliver(m.userId, {
          type: 'INVITATION_ACCEPTED',
          title: 'New member joined the workspace',
          body: undefined,
          resourceType: 'workspace',
          resourceId: payload.workspaceId,
        });
      }
    } catch (err) {
      this.logger.error('Failed to handle InvitationAccepted', err);
    }
  }

  private async handleFileUploaded(payload: FileUploadedPayload): Promise<void> {
    if (!payload.boardId) return;
    try {
      const board = await this.boardsRepo.findById(payload.boardId);
      if (!board) return;
      const members = await this.workspaceMembersRepo.listByWorkspace(board.workspaceId);
      for (const m of members) {
        if (m.userId === payload.userId) continue;
        await this.notifications.createAndDeliver(m.userId, {
          type: 'FILE_UPLOADED',
          title: 'File uploaded to board',
          body: payload.originalName,
          resourceType: 'board',
          resourceId: payload.boardId,
        });
      }
    } catch (err) {
      this.logger.error('Failed to handle FileUploaded', err);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/notifications/handlers/notification.handler.ts
git commit -m "feat(notifications): add NotificationHandler subscribing to domain events"
```

---

### Task 5: Update NotificationsModule

**Files:**
- Modify: `apps/api/src/modules/notifications/notifications.module.ts`

- [ ] **Step 1: Register NotificationHandler + NotificationPolicy + imported repositories**

```ts
import { Module } from '@nestjs/common';

import { BoardsRepository } from '../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../workspaces/repositories/workspace-members.repository';
import { BoardsEventBus } from '../boards/events/boards.events';
import { CommentsEventBus } from '../comments/events/comments.events';
import { TasksEventBus } from '../tasks/events/tasks.events';
import { WorkspacesEventBus } from '../workspaces/events/workspaces.events';
import { UploadsEventBus } from '../uploads/events/uploads.events';

import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsEventBus } from './events/notifications.events';
import { NotificationHandler } from './handlers/notification.handler';
import { NotificationPolicy } from './policies/notification.policy';
import { NotificationsRepository } from './repositories/notifications.repository';
import { NotificationsService } from './services/notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsEventBus,
    NotificationPolicy,
    NotificationHandler,
    BoardsRepository,
    WorkspaceMembersRepository,
    BoardsEventBus,
    CommentsEventBus,
    TasksEventBus,
    WorkspacesEventBus,
    UploadsEventBus,
  ],
  exports: [NotificationsService, NotificationsEventBus],
})
export class NotificationsModule {}
```

- [ ] **Step 2: Verify build**

```bash
pnpm run build
```
Expected: builds successfully (2/2).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/notifications/notifications.module.ts
git commit -m "feat(notifications): register NotificationHandler, policy, and imported providers"
```

---

### Task 6: Write notification handler test

**Files:**
- Create: `apps/api/src/modules/notifications/handlers/notification.handler.spec.ts`

- [ ] **Step 1: Create the test file**

```ts
import { Test, type TestingModule } from '@nestjs/testing';

import { BoardsEventBus } from '../../boards/events/boards.events';
import { CommentsEventBus } from '../../comments/events/comments.events';
import { TasksEventBus } from '../../tasks/events/tasks.events';
import { WorkspacesEventBus } from '../../workspaces/events/workspaces.events';
import { UploadsEventBus } from '../../uploads/events/uploads.events';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';
import { BoardsRepository } from '../../boards/repositories/boards.repository';
import { NotificationsService } from '../services/notifications.service';
import { NotificationsRepository } from '../repositories/notifications.repository';
import { NotificationHandler } from './notification.handler';

describe('NotificationHandler', () => {
  let handler: NotificationHandler;
  let module: TestingModule;
  let notificationsService: NotificationsService;

  const mockDb = {
    insert: jest.fn().mockReturnValue({ values: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([{}]) }) }),
    select: jest.fn().mockReturnValue({ from: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]), orderBy: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]), offset: jest.fn().mockReturnValue([]) }) }) }) }),
    update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([{}]) }) }) }),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        NotificationHandler,
        NotificationsService,
        NotificationsRepository,
        BoardsEventBus,
        CommentsEventBus,
        TasksEventBus,
        WorkspacesEventBus,
        UploadsEventBus,
        BoardsRepository,
        WorkspaceMembersRepository,
        { provide: 'DATABASE', useValue: mockDb },
      ],
    }).compile();

    handler = module.get<NotificationHandler>(NotificationHandler);
    notificationsService = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('handleMemberAdded', () => {
    it('should create notification for the added member', async () => {
      const createSpy = jest.spyOn(notificationsService, 'createAndDeliver').mockResolvedValue({} as never);

      const bus = module.get<WorkspacesEventBus>(WorkspacesEventBus);
      bus.publishMemberAdded({
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'MEMBER',
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(createSpy).toHaveBeenCalledWith('user-1', {
        type: 'MEMBER_ADDED',
        title: 'You were added to a workspace',
        body: undefined,
        resourceType: 'workspace',
        resourceId: 'ws-1',
      });
    });
  });

  describe('handleTaskCreated', () => {
    it('should create notification when assignee is set', async () => {
      const createSpy = jest.spyOn(notificationsService, 'createAndDeliver').mockResolvedValue({} as never);

      const bus = module.get<TasksEventBus>(TasksEventBus);
      bus.publishTaskCreated({
        taskId: 'task-1',
        boardId: 'board-1',
        columnId: 'col-1',
        createdBy: 'user-2',
        assigneeId: 'user-1',
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(createSpy).toHaveBeenCalledWith('user-1', {
        type: 'TASK_ASSIGNED',
        title: 'You were assigned a task',
        body: undefined,
        resourceType: 'task',
        resourceId: 'task-1',
      });
    });

    it('should not create notification when no assignee', async () => {
      const createSpy = jest.spyOn(notificationsService, 'createAndDeliver').mockResolvedValue({} as never);

      const bus = module.get<TasksEventBus>(TasksEventBus);
      bus.publishTaskCreated({
        taskId: 'task-2',
        boardId: 'board-1',
        columnId: 'col-1',
        createdBy: 'user-2',
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(createSpy).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter api run test
```
Expected: new tests pass (existing 184 + new).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/notifications/handlers/notification.handler.spec.ts
git commit -m "test(notifications): add NotificationHandler tests"
```

---

### Task 7: Final verification

**Files:**
- N/A — build/test/type/lint check

- [ ] **Step 1: Run full verification**

```bash
pnpm run build && pnpm run check-types && pnpm run lint && pnpm --filter api run test
```
Expected: all pass.
