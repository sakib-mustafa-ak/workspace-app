import { Inject, Injectable } from '@nestjs/common';

import {
  DATABASE,
  and,
  eq,
  type Db,
  type WorkspaceRole,
  type ChecklistItemRow,
  workspaceMembers,
  tasks,
} from '@repo/database';

import {
  ChecklistErrorCode,
  ChecklistException,
} from '../errors/checklist.errors';
import { ChecklistPolicy } from '../policies/checklist.policy';
import { ChecklistRepository } from '../repositories/checklist.repository';
import type { CreateChecklistDto } from '../dto/create-checklist.dto';
import type { UpdateChecklistDto } from '../dto/update-checklist.dto';

@Injectable()
export class ChecklistService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(ChecklistRepository) private readonly repo: ChecklistRepository,
    @Inject(ChecklistPolicy) private readonly policy: ChecklistPolicy,
  ) {}

  public async listByTask(
    taskId: string,
    userId: string,
  ): Promise<ChecklistItemRow[]> {
    await this.requireTaskAccess(taskId, userId, 'VIEWER');
    return this.repo.listByTask(taskId);
  }

  public async create(
    taskId: string,
    userId: string,
    dto: CreateChecklistDto,
  ): Promise<ChecklistItemRow> {
    await this.requireTaskAccess(taskId, userId, 'EDITOR');
    return this.repo.create({
      taskId,
      text: dto.text,
      position: dto.position ?? 0,
    });
  }

  public async update(
    itemId: string,
    userId: string,
    dto: UpdateChecklistDto,
  ): Promise<ChecklistItemRow> {
    const item = await this.repo.findById(itemId);
    if (!item) {
      throw new ChecklistException(
        ChecklistErrorCode.ITEM_NOT_FOUND,
        'Checklist item not found.',
      );
    }

    await this.requireTaskAccess(item.taskId, userId, 'EDITOR');
    return this.repo.update(itemId, dto);
  }

  public async delete(itemId: string, userId: string): Promise<void> {
    const item = await this.repo.findById(itemId);
    if (!item) {
      throw new ChecklistException(
        ChecklistErrorCode.ITEM_NOT_FOUND,
        'Checklist item not found.',
      );
    }

    await this.requireTaskAccess(item.taskId, userId, 'EDITOR');
    await this.repo.delete(itemId);
  }

  private async requireTaskAccess(
    taskId: string,
    userId: string,
    minimumRole: WorkspaceRole,
  ): Promise<void> {
    const task = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!task) {
      throw new ChecklistException(
        ChecklistErrorCode.ITEM_NOT_FOUND,
        'Task not found.',
      );
    }

    const [membership] = await this.db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, task.workspaceId),
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, 'ACTIVE'),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ChecklistException(
        ChecklistErrorCode.NOT_A_MEMBER,
        'Not a member.',
      );
    }

    if (!this.policy.isAtLeast(membership.role, minimumRole)) {
      throw new ChecklistException(
        ChecklistErrorCode.INSUFFICIENT_ROLE,
        `Requires ${minimumRole} role or higher.`,
      );
    }
  }
}
