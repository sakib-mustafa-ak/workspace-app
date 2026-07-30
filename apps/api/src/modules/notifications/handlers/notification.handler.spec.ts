import { Test, TestingModule } from '@nestjs/testing';
import { NotificationHandler } from './notification.handler';
import { NotificationsService } from '../services/notifications.service';
import { BoardsEventBus } from '../../boards/events/boards.events';
import { CommentsEventBus } from '../../comments/events/comments.events';
import { TasksEventBus } from '../../tasks/events/tasks.events';
import { WorkspacesEventBus } from '../../workspaces/events/workspaces.events';
import { UploadsEventBus } from '../../uploads/events/uploads.events';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';
import { BoardsRepository } from '../../boards/repositories/boards.repository';

describe('NotificationHandler', () => {
  let handler: NotificationHandler;
  let notificationsService: jest.Mocked<NotificationsService>;
  let boardsEventBus: BoardsEventBus;
  let commentsEventBus: CommentsEventBus;
  let tasksEventBus: TasksEventBus;
  let workspacesEventBus: WorkspacesEventBus;
  let uploadsEventBus: UploadsEventBus;
  let workspaceMembersRepo: jest.Mocked<WorkspaceMembersRepository>;
  let boardsRepo: jest.Mocked<BoardsRepository>;

  beforeEach(async () => {
    notificationsService = {
      createAndDeliver: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationsService>;

    workspaceMembersRepo = {
      listByWorkspace: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<WorkspaceMembersRepository>;

    boardsRepo = {
      findById: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<BoardsRepository>;

    boardsEventBus = new BoardsEventBus();
    commentsEventBus = new CommentsEventBus();
    tasksEventBus = new TasksEventBus();
    workspacesEventBus = new WorkspacesEventBus();
    uploadsEventBus = new UploadsEventBus();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationHandler,
        { provide: NotificationsService, useValue: notificationsService },
        { provide: BoardsEventBus, useValue: boardsEventBus },
        { provide: CommentsEventBus, useValue: commentsEventBus },
        { provide: TasksEventBus, useValue: tasksEventBus },
        { provide: WorkspacesEventBus, useValue: workspacesEventBus },
        { provide: UploadsEventBus, useValue: uploadsEventBus },
        { provide: WorkspaceMembersRepository, useValue: workspaceMembersRepo },
        { provide: BoardsRepository, useValue: boardsRepo },
      ],
    }).compile();

    handler = module.get<NotificationHandler>(NotificationHandler);
    handler.onModuleInit();
  });

  it('should deliver BOARD_SHARED notification to non-creator workspace members on BoardCreated', async () => {
    workspaceMembersRepo.listByWorkspace.mockResolvedValue([
      {
        id: 'm1',
        workspaceId: 'ws-1',
        userId: 'user-creator',
        role: 'OWNER',
        status: 'ACTIVE',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        invitationId: null,
      } as any,
      {
        id: 'm2',
        workspaceId: 'ws-1',
        userId: 'user-other',
        role: 'EDITOR',
        status: 'ACTIVE',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        invitationId: null,
      } as any,
    ]);

    boardsEventBus.publishBoardCreated({
      boardId: 'b-1',
      workspaceId: 'ws-1',
      createdBy: 'user-creator',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(notificationsService.createAndDeliver).toHaveBeenCalledTimes(1);
    expect(notificationsService.createAndDeliver).toHaveBeenCalledWith(
      'user-other',
      {
        type: 'BOARD_SHARED',
        title: 'New board created',
        body: undefined,
        resourceType: 'board',
        resourceId: 'b-1',
      },
    );
  });

  it('should deliver TASK_ASSIGNED notification on TaskCreated when assigneeId is present', async () => {
    tasksEventBus.publishTaskCreated({
      taskId: 't-1',
      boardId: 'b-1',
      columnId: 'c-1',
      createdBy: 'user-1',
      assigneeId: 'user-2',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(notificationsService.createAndDeliver).toHaveBeenCalledWith(
      'user-2',
      {
        type: 'TASK_ASSIGNED',
        title: 'You were assigned a task',
        body: undefined,
        resourceType: 'task',
        resourceId: 't-1',
      },
    );
  });

  it('should deliver MEMBER_ADDED notification on MemberAdded', async () => {
    workspacesEventBus.publishMemberAdded({
      workspaceId: 'ws-1',
      userId: 'user-3',
      role: 'MEMBER',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(notificationsService.createAndDeliver).toHaveBeenCalledWith(
      'user-3',
      {
        type: 'MEMBER_ADDED',
        title: 'You were added to a workspace',
        body: undefined,
        resourceType: 'workspace',
        resourceId: 'ws-1',
      },
    );
  });
});
