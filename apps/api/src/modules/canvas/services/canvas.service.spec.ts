import { Test, TestingModule } from '@nestjs/testing';
import { CanvasService } from './canvas.service';
import { CanvasRepository } from '../repositories/canvas.repository';
import { BoardsRepository } from '../../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';
import { CanvasEventBus } from '../events/canvas.events';
import { CanvasPolicy } from '../policies/canvas.policy';
import { CanvasException } from '../errors/canvas.errors';

describe('CanvasService', () => {
  let service: CanvasService;
  let canvasRepo: jest.Mocked<CanvasRepository>;
  let boardsRepo: jest.Mocked<BoardsRepository>;
  let membersRepo: jest.Mocked<WorkspaceMembersRepository>;
  let eventBus: jest.Mocked<CanvasEventBus>;

  beforeEach(async () => {
    canvasRepo = {
      findByBoard: jest.fn(),
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
    boardsRepo.findById.mockResolvedValue(null);
    await expect(service.getOrCreateCanvas('b-999', 'user-1')).rejects.toThrow(
      CanvasException,
    );
  });

  it('should return existing canvas and its objects when found', async () => {
    boardsRepo.findById.mockResolvedValue({
      id: 'b-1',
      workspaceId: 'ws-1',
      title: 'Board 1',
    } as any);

    membersRepo.findByWorkspaceAndUser.mockResolvedValue({
      id: 'm-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: 'OWNER',
    } as any);

    canvasRepo.findByBoard.mockResolvedValue({
      id: 'c-1',
      boardId: 'b-1',
      workspaceId: 'ws-1',
    } as any);

    canvasRepo.findObjectsByCanvas.mockResolvedValue([
      { id: 'obj-1', canvasId: 'c-1', type: 'RECTANGLE', x: 10, y: 10 } as any,
    ]);

    const res = await service.getOrCreateCanvas('b-1', 'user-1');
    expect(res.canvas.id).toBe('c-1');
    expect(res.objects).toHaveLength(1);
  });

  it('should create new canvas object and publish event in createObject', async () => {
    boardsRepo.findById.mockResolvedValue({
      id: 'b-1',
      workspaceId: 'ws-1',
    } as any);

    membersRepo.findByWorkspaceAndUser.mockResolvedValue({
      id: 'm-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: 'ADMIN',
    } as any);

    canvasRepo.findByBoard.mockResolvedValue({
      id: 'c-1',
      boardId: 'b-1',
      workspaceId: 'ws-1',
    } as any);

    canvasRepo.createObject.mockResolvedValue({
      id: 'obj-100',
      canvasId: 'c-1',
      type: 'STICKY_NOTE',
      x: 50,
      y: 50,
      width: 200,
      height: 200,
    } as any);

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
      canvasId: 'c-1',
      boardId: 'b-1',
      userId: 'user-1',
      type: 'STICKY_NOTE',
    });
  });

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
});
