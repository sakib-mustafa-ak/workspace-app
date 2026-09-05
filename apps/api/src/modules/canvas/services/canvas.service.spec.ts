import { Test, TestingModule } from '@nestjs/testing';
import { CanvasService } from './canvas.service';
import { CanvasRepository } from '../repositories/canvas.repository';
import { BoardsRepository } from '../../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';
import { CanvasEventBus } from '../events/canvas.events';
import { CanvasPolicy } from '../policies/canvas.policy';
import { CanvasException } from '../errors/canvas.errors';
import {
  type BoardRow,
  type CanvasRow,
  type CanvasObjectRow,
  type WorkspaceMemberRow,
} from '@repo/database';

const makeBoard = (overrides: Partial<BoardRow> = {}): BoardRow => ({
  id: 'b-1',
  workspaceId: 'ws-1',
  name: 'Board 1',
  description: null,
  position: 0,
  searchVector: '',
  status: 'ACTIVE',
  archivedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

const makeCanvas = (overrides: Partial<CanvasRow> = {}): CanvasRow => ({
  id: 'c-1',
  boardId: 'b-1',
  workspaceId: 'ws-1',
  name: 'Canvas',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

const makeObject = (
  overrides: Partial<CanvasObjectRow> = {},
): CanvasObjectRow => ({
  id: 'obj-1',
  canvasId: 'c-1',
  parentId: null,
  type: 'RECTANGLE',
  status: 'ACTIVE',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  zIndex: 0,
  fill: null,
  stroke: null,
  strokeWidth: 1,
  opacity: 1,
  data: null,
  createdById: 'user-1',
  archivedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

const makeMember = (
  overrides: Partial<WorkspaceMemberRow> = {},
): WorkspaceMemberRow => ({
  id: 'm-1',
  workspaceId: 'ws-1',
  userId: 'user-1',
  role: 'OWNER',
  status: 'ACTIVE',
  joinedAt: new Date('2026-01-01T00:00:00.000Z'),
  invitationId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

describe('CanvasService', () => {
  let service: CanvasService;
  let canvasRepo: jest.Mocked<CanvasRepository>;
  let boardsRepo: jest.Mocked<BoardsRepository>;
  let membersRepo: jest.Mocked<WorkspaceMembersRepository>;
  let eventBus: jest.Mocked<CanvasEventBus>;

  beforeEach(async () => {
    canvasRepo = {
      findByBoard: jest.fn(),
      findById: jest.fn(),
      findObjectsByCanvas: jest.fn(),
      create: jest.fn(),
      createObject: jest.fn(),
      findObjectById: jest.fn(),
      updateObject: jest.fn(),
      softDeleteObject: jest.fn(),
    } as unknown as jest.Mocked<CanvasRepository>;

    boardsRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<BoardsRepository>;

    membersRepo = {
      findByWorkspaceAndUser: jest.fn(),
    } as unknown as jest.Mocked<WorkspaceMembersRepository>;

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
        CanvasService,
        CanvasPolicy,
        { provide: CanvasRepository, useValue: canvasRepo },
        { provide: BoardsRepository, useValue: boardsRepo },
        { provide: WorkspaceMembersRepository, useValue: membersRepo },
        { provide: CanvasEventBus, useValue: eventBus },
      ],
    }).compile();

    service = module.get<CanvasService>(CanvasService);
  });

  it('should throw BOARD_NOT_FOUND when board does not exist in getOrCreateCanvas', async () => {
    boardsRepo.findById.mockResolvedValue(undefined);
    await expect(service.getOrCreateCanvas('b-999', 'user-1')).rejects.toThrow(
      CanvasException,
    );
  });

  it('should return existing canvas and its objects when found', async () => {
    boardsRepo.findById.mockResolvedValue(
      makeBoard({ id: 'b-1', workspaceId: 'ws-1', name: 'Board 1' }),
    );

    membersRepo.findByWorkspaceAndUser.mockResolvedValue(
      makeMember({
        id: 'm-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'OWNER',
      }),
    );

    canvasRepo.findByBoard.mockResolvedValue(
      makeCanvas({ id: 'c-1', boardId: 'b-1', workspaceId: 'ws-1' }),
    );

    canvasRepo.findObjectsByCanvas.mockResolvedValue([
      makeObject({
        id: 'obj-1',
        canvasId: 'c-1',
        type: 'RECTANGLE',
        x: 10,
        y: 10,
      }),
    ]);

    const res = await service.getOrCreateCanvas('b-1', 'user-1');
    expect(res.canvas.id).toBe('c-1');
    expect(res.objects).toHaveLength(1);
  });

  it('should create new canvas object and publish event in createObject', async () => {
    boardsRepo.findById.mockResolvedValue(
      makeBoard({ id: 'b-1', workspaceId: 'ws-1' }),
    );

    membersRepo.findByWorkspaceAndUser.mockResolvedValue(
      makeMember({
        id: 'm-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'ADMIN',
      }),
    );

    canvasRepo.findByBoard.mockResolvedValue(
      makeCanvas({ id: 'c-1', boardId: 'b-1', workspaceId: 'ws-1' }),
    );

    canvasRepo.createObject.mockResolvedValue(
      makeObject({
        id: 'obj-100',
        canvasId: 'c-1',
        type: 'STICKY_NOTE',
        x: 50,
        y: 50,
        width: 200,
        height: 200,
      }),
    );

    const obj = await service.createObject('b-1', 'user-1', {
      type: 'STICKY_NOTE',
      x: 50,
      y: 50,
      width: 200,
      height: 200,
    });

    expect(obj.id).toBe('obj-100');
    expect(eventBus.publishObjectCreated).toHaveBeenCalledWith({
      objectId: 'obj-100',
      workspaceId: 'ws-1',
      canvasId: 'c-1',
      boardId: 'b-1',
      userId: 'user-1',
      type: 'STICKY_NOTE',
    });
  });

  it('should publish objectUpdated event when updating an object', async () => {
    boardsRepo.findById.mockResolvedValue(
      makeBoard({ id: 'b-1', workspaceId: 'ws-1' }),
    );
    membersRepo.findByWorkspaceAndUser.mockResolvedValue(
      makeMember({
        id: 'm-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'OWNER',
      }),
    );
    canvasRepo.findObjectById.mockResolvedValue(
      makeObject({ id: 'obj-1', canvasId: 'c-1', type: 'RECTANGLE' }),
    );
    canvasRepo.findById.mockResolvedValue(
      makeCanvas({ id: 'c-1', boardId: 'b-1', workspaceId: 'ws-1' }),
    );
    canvasRepo.updateObject.mockResolvedValue(
      makeObject({ id: 'obj-1', canvasId: 'c-1', x: 200, y: 300 }),
    );

    await service.updateObject('b-1', 'obj-1', 'user-1', { x: 200, y: 300 });

    expect(eventBus.publishObjectUpdated).toHaveBeenCalledWith({
      objectId: 'obj-1',
      workspaceId: 'ws-1',
      canvasId: 'c-1',
      boardId: 'b-1',
      userId: 'user-1',
    });
  });

  it('rejects updating an object whose canvas belongs to a different board (cross-workspace path)', async () => {
    // Regression: updateObject used to authorize against the PATH board's
    // workspace while mutating the object found by raw objectId, so a
    // member of workspace A could edit workspace B's objects by pairing
    // their own boardId with a foreign objectId.
    boardsRepo.findById.mockResolvedValue(
      makeBoard({ id: 'b-mine', workspaceId: 'ws-mine' }),
    );
    membersRepo.findByWorkspaceAndUser.mockResolvedValue(
      makeMember({
        id: 'm-1',
        workspaceId: 'ws-mine',
        userId: 'user-1',
        role: 'OWNER',
      }),
    );
    canvasRepo.findObjectById.mockResolvedValue(
      makeObject({
        id: 'obj-foreign',
        canvasId: 'c-foreign',
        type: 'RECTANGLE',
      }),
    );
    canvasRepo.findById.mockResolvedValue(
      makeCanvas({
        id: 'c-foreign',
        boardId: 'b-theirs',
        workspaceId: 'ws-theirs',
      }),
    );

    await expect(
      service.updateObject('b-mine', 'obj-foreign', 'user-1', { x: 1 }),
    ).rejects.toThrow(CanvasException);
    expect(canvasRepo.updateObject).not.toHaveBeenCalled();
  });

  it('rejects deleting an object whose canvas belongs to a different board (cross-workspace path)', async () => {
    boardsRepo.findById.mockResolvedValue(
      makeBoard({ id: 'b-mine', workspaceId: 'ws-mine' }),
    );
    membersRepo.findByWorkspaceAndUser.mockResolvedValue(
      makeMember({
        id: 'm-1',
        workspaceId: 'ws-mine',
        userId: 'user-1',
        role: 'OWNER',
      }),
    );
    canvasRepo.findObjectById.mockResolvedValue(
      makeObject({ id: 'obj-foreign', canvasId: 'c-foreign' }),
    );
    canvasRepo.findById.mockResolvedValue(
      makeCanvas({
        id: 'c-foreign',
        boardId: 'b-theirs',
        workspaceId: 'ws-theirs',
      }),
    );

    await expect(
      service.deleteObject('b-mine', 'obj-foreign', 'user-1'),
    ).rejects.toThrow(CanvasException);
    expect(canvasRepo.softDeleteObject).not.toHaveBeenCalled();
  });

  it('should publish objectDeleted event when deleting an object', async () => {
    boardsRepo.findById.mockResolvedValue(
      makeBoard({ id: 'b-1', workspaceId: 'ws-1' }),
    );
    membersRepo.findByWorkspaceAndUser.mockResolvedValue(
      makeMember({
        id: 'm-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'OWNER',
      }),
    );
    canvasRepo.findObjectById.mockResolvedValue(
      makeObject({ id: 'obj-1', canvasId: 'c-1' }),
    );
    canvasRepo.findById.mockResolvedValue(
      makeCanvas({ id: 'c-1', boardId: 'b-1', workspaceId: 'ws-1' }),
    );
    canvasRepo.softDeleteObject.mockResolvedValue(undefined);

    await service.deleteObject('b-1', 'obj-1', 'user-1');

    expect(eventBus.publishObjectDeleted).toHaveBeenCalledWith({
      objectId: 'obj-1',
      workspaceId: 'ws-1',
      canvasId: 'c-1',
      boardId: 'b-1',
      deletedBy: 'user-1',
    });
  });
});
