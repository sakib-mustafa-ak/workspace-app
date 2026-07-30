import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserModel } from '../../auth/interfaces/current-user.interface';

import { ChecklistService } from '../services/checklist.service';
import { CreateChecklistDto } from '../dto/create-checklist.dto';
import { UpdateChecklistDto } from '../dto/update-checklist.dto';
import { ChecklistItemResponseDto } from '../dto/checklist-response.dto';

@ApiTags('Checklist')
@ApiBearerAuth()
@Controller({
  path: 'workspaces/:workspaceId/boards/:boardId/tasks/:taskId/checklist',
  version: '1',
})
export class ChecklistController {
  constructor(
    @Inject(ChecklistService) private readonly checklist: ChecklistService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List checklist items for a task' })
  @ApiOkResponse({ type: [ChecklistItemResponseDto] })
  public async list(
    @CurrentUser() user: CurrentUserModel,
    @Param('taskId') taskId: string,
  ): Promise<ChecklistItemResponseDto[]> {
    const items = await this.checklist.listByTask(taskId, user.id);
    return items.map(toResponse);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a checklist item' })
  @ApiCreatedResponse({ type: ChecklistItemResponseDto })
  public async create(
    @CurrentUser() user: CurrentUserModel,
    @Param('taskId') taskId: string,
    @Body() body: CreateChecklistDto,
  ): Promise<ChecklistItemResponseDto> {
    const item = await this.checklist.create(taskId, user.id, body);
    return toResponse(item);
  }

  @Patch(':itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a checklist item' })
  @ApiOkResponse({ type: ChecklistItemResponseDto })
  public async update(
    @CurrentUser() user: CurrentUserModel,
    @Param('itemId') itemId: string,
    @Body() body: UpdateChecklistDto,
  ): Promise<ChecklistItemResponseDto> {
    const item = await this.checklist.update(itemId, user.id, body);
    return toResponse(item);
  }

  @Delete(':itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a checklist item' })
  public async delete(
    @CurrentUser() user: CurrentUserModel,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    await this.checklist.delete(itemId, user.id);
  }
}

function toResponse(item: {
  id: string;
  taskId: string;
  text: string;
  completed: boolean;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}): ChecklistItemResponseDto {
  return {
    id: item.id,
    taskId: item.taskId,
    text: item.text,
    completed: item.completed,
    position: item.position,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
