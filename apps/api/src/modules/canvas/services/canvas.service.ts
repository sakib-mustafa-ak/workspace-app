import { Inject, Injectable } from '@nestjs/common';

import { BoardsRepository } from '../../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';

import { CanvasRepository } from '../repositories/canvas.repository';
import { CanvasEventBus } from '../events/canvas.events';
import { CanvasPolicy } from '../policies/canvas.policy';
import { CanvasException, CanvasErrorCode } from '../errors/canvas.errors';
import type { CreateCanvasObjectDto } from '../dto/create-object.dto';
import type { UpdateCanvasObjectDto } from '../dto/update-object.dto';

@Injectable()
export class CanvasService {
  constructor(
    @Inject(CanvasRepository) private readonly canvasRepo: CanvasRepository,
    @Inject(BoardsRepository) private readonly boardsRepo: BoardsRepository,
    @Inject(WorkspaceMembersRepository)
    private readonly membersRepo: WorkspaceMembersRepository,
    @Inject(CanvasEventBus) private readonly eventBus: CanvasEventBus,
    @Inject(CanvasPolicy) private readonly policy: CanvasPolicy,
  ) {}

  async getOrCreateCanvas(boardId: string, userId: string) {
    const board = await this.boardsRepo.findById(boardId);
    if (!board) {
      throw new CanvasException(
        CanvasErrorCode.BOARD_NOT_FOUND,
        'Board not found',
      );
    }
    const membership = await this.membersRepo.findByWorkspaceAndUser(
      board.workspaceId,
      userId,
    );
    if (!membership) {
      throw new CanvasException(
        CanvasErrorCode.NOT_A_MEMBER,
        'Not a workspace member',
      );
    }
    if (!this.policy.canView(membership.role)) {
      throw new CanvasException(
        CanvasErrorCode.INSUFFICIENT_ROLE,
        'Insufficient role',
      );
    }

    const existing = await this.canvasRepo.findByBoard(boardId);
    if (existing) {
      const objects = await this.canvasRepo.findObjectsByCanvas(existing.id);
      return { canvas: existing, objects };
    }

    const newCanvas = await this.canvasRepo.create({
      boardId,
      workspaceId: board.workspaceId,
    });
    return { canvas: newCanvas, objects: [] };
  }

  async createObject(
    boardId: string,
    userId: string,
    dto: CreateCanvasObjectDto,
  ) {
    const board = await this.boardsRepo.findById(boardId);
    if (!board) {
      throw new CanvasException(
        CanvasErrorCode.BOARD_NOT_FOUND,
        'Board not found',
      );
    }
    const membership = await this.membersRepo.findByWorkspaceAndUser(
      board.workspaceId,
      userId,
    );
    if (!membership) {
      throw new CanvasException(
        CanvasErrorCode.NOT_A_MEMBER,
        'Not a workspace member',
      );
    }
    if (!this.policy.canEdit(membership.role)) {
      throw new CanvasException(
        CanvasErrorCode.INSUFFICIENT_ROLE,
        'Insufficient role',
      );
    }

    let canvasRow = await this.canvasRepo.findByBoard(boardId);
    if (!canvasRow) {
      canvasRow = await this.canvasRepo.create({
        boardId,
        workspaceId: board.workspaceId,
      });
    }

    const object = await this.canvasRepo.createObject({
      ...(dto.id ? { id: dto.id } : {}),
      canvasId: canvasRow.id,
      type: dto.type as
        | 'RECTANGLE'
        | 'ELLIPSE'
        | 'TEXT'
        | 'STICKY_NOTE'
        | 'IMAGE'
        | 'ARROW'
        | 'LINE'
        | 'PATH'
        | 'FRAME'
        | 'CONNECTOR',
      x: dto.x ?? 0,
      y: dto.y ?? 0,
      width: dto.width ?? 100,
      height: dto.height ?? 100,
      rotation: dto.rotation ?? 0,
      zIndex: dto.zIndex ?? 0,
      fill: dto.fill ?? null,
      stroke: dto.stroke ?? null,
      strokeWidth: dto.strokeWidth ?? 1,
      opacity: dto.opacity ?? 1,
      data: dto.data ?? null,
      createdById: userId,
    });

    this.eventBus.publishObjectCreated({
      objectId: object.id,
      canvasId: canvasRow.id,
      boardId,
      userId,
      type: dto.type,
    });

    return object;
  }

  async updateObject(
    boardId: string,
    objectId: string,
    userId: string,
    dto: UpdateCanvasObjectDto,
  ) {
    const object = await this.canvasRepo.findObjectById(objectId);
    if (!object) {
      throw new CanvasException(
        CanvasErrorCode.OBJECT_NOT_FOUND,
        'Object not found',
      );
    }

    const board = await this.boardsRepo.findById(boardId);
    if (!board) {
      throw new CanvasException(
        CanvasErrorCode.BOARD_NOT_FOUND,
        'Board not found',
      );
    }
    const membership = await this.membersRepo.findByWorkspaceAndUser(
      board.workspaceId,
      userId,
    );
    if (!membership) {
      throw new CanvasException(
        CanvasErrorCode.NOT_A_MEMBER,
        'Not a workspace member',
      );
    }
    if (!this.policy.canEdit(membership.role)) {
      throw new CanvasException(
        CanvasErrorCode.INSUFFICIENT_ROLE,
        'Insufficient role',
      );
    }

    const updated = await this.canvasRepo.updateObject(objectId, dto);
    if (!updated) {
      throw new CanvasException(
        CanvasErrorCode.OBJECT_NOT_FOUND,
        'Object not found',
      );
    }

    this.eventBus.publishObjectUpdated({
      objectId,
      canvasId: object.canvasId,
      boardId,
      userId,
    });

    return updated;
  }

  async deleteObject(boardId: string, objectId: string, userId: string) {
    const object = await this.canvasRepo.findObjectById(objectId);
    if (!object) {
      throw new CanvasException(
        CanvasErrorCode.OBJECT_NOT_FOUND,
        'Object not found',
      );
    }

    const board = await this.boardsRepo.findById(boardId);
    if (!board) {
      throw new CanvasException(
        CanvasErrorCode.BOARD_NOT_FOUND,
        'Board not found',
      );
    }
    const membership = await this.membersRepo.findByWorkspaceAndUser(
      board.workspaceId,
      userId,
    );
    if (!membership) {
      throw new CanvasException(
        CanvasErrorCode.NOT_A_MEMBER,
        'Not a workspace member',
      );
    }
    if (!this.policy.canEdit(membership.role)) {
      throw new CanvasException(
        CanvasErrorCode.INSUFFICIENT_ROLE,
        'Insufficient role',
      );
    }

    await this.canvasRepo.softDeleteObject(objectId);

    this.eventBus.publishObjectDeleted({
      objectId,
      canvasId: object.canvasId,
      boardId,
      deletedBy: userId,
    });
  }
}
