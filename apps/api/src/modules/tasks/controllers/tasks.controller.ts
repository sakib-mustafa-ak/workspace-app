import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserModel } from '../../auth/interfaces/current-user.interface';

import { TasksService } from '../services/tasks.service';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { MoveTaskDto } from '../dto/move-task.dto';
import { TaskResponseDto } from '../dto/task-response.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller({
  path: 'workspaces/:workspaceId/boards/:boardId/tasks',
  version: '1',
})
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post('columns/:columnId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a task in a column' })
  @ApiCreatedResponse({ type: TaskResponseDto })
  public async create(
    @CurrentUser() user: CurrentUserModel,
    @Param('workspaceId') workspaceId: string,
    @Param('boardId') boardId: string,
    @Param('columnId') columnId: string,
    @Body() body: CreateTaskDto,
  ): Promise<TaskResponseDto> {
    const task = await this.tasks.create(
      columnId,
      boardId,
      workspaceId,
      user.id,
      body,
    );
    return toTaskResponse(task);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List tasks in a board' })
  @ApiOkResponse({ type: [TaskResponseDto] })
  public async listByBoard(
    @CurrentUser() user: CurrentUserModel,
    @Param('workspaceId') workspaceId: string,
    @Param('boardId') boardId: string,
  ): Promise<TaskResponseDto[]> {
    const list = await this.tasks.listByBoard(boardId, workspaceId, user.id);
    return list.map(toTaskResponse);
  }

  @Get('columns/:columnId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List tasks in a column' })
  @ApiOkResponse({ type: [TaskResponseDto] })
  public async listByColumn(
    @CurrentUser() user: CurrentUserModel,
    @Param('workspaceId') workspaceId: string,
    @Param('boardId') boardId: string,
    @Param('columnId') columnId: string,
  ): Promise<TaskResponseDto[]> {
    const list = await this.tasks.listByColumn(
      columnId,
      boardId,
      workspaceId,
      user.id,
    );
    return list.map(toTaskResponse);
  }

  @Get(':taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse()
  public async getById(
    @Param('taskId') taskId: string,
  ): Promise<TaskResponseDto> {
    const task = await this.tasks.getById(taskId);
    return toTaskResponse(task);
  }

  @Patch(':taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update task' })
  @ApiOkResponse({ type: TaskResponseDto })
  public async update(
    @CurrentUser() user: CurrentUserModel,
    @Param('taskId') taskId: string,
    @Body() body: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    const task = await this.tasks.update(taskId, user.id, body);
    return toTaskResponse(task);
  }

  @Patch(':taskId/move')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move task to another column' })
  @ApiOkResponse({ type: TaskResponseDto })
  public async move(
    @CurrentUser() user: CurrentUserModel,
    @Param('taskId') taskId: string,
    @Body() body: MoveTaskDto,
  ): Promise<TaskResponseDto> {
    const task = await this.tasks.move(
      taskId,
      user.id,
      body.columnId,
      body.position,
    );
    return toTaskResponse(task);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete task' })
  public async delete(
    @CurrentUser() user: CurrentUserModel,
    @Param('taskId') taskId: string,
  ): Promise<void> {
    await this.tasks.delete(taskId, user.id);
  }
}

function toTaskResponse(t: {
  id: string;
  workspaceId: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  status: unknown;
  priority: unknown;
  assigneeId: string | null;
  createdById: string;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): TaskResponseDto {
  return {
    id: t.id,
    workspaceId: t.workspaceId,
    boardId: t.boardId,
    columnId: t.columnId,
    title: t.title,
    description: t.description,
    position: t.position,
    status: t.status as TaskResponseDto['status'],
    priority: t.priority as TaskResponseDto['priority'],
    assigneeId: t.assigneeId,
    createdById: t.createdById,
    dueDate: t.dueDate,
    completedAt: t.completedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
