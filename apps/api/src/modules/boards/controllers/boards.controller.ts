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

import { BoardsService } from '../services/boards.service';
import { CreateBoardDto } from '../dto/create-board.dto';
import { UpdateBoardDto } from '../dto/update-board.dto';
import {
  BoardResponseDto,
  BoardColumnResponseDto,
} from '../dto/board-response.dto';
import { CreateColumnDto } from '../dto/create-column.dto';
import { UpdateColumnDto } from '../dto/update-column.dto';

@ApiTags('Boards')
@ApiBearerAuth()
@Controller({ path: 'workspaces/:workspaceId/boards', version: '1' })
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a board in a workspace' })
  @ApiCreatedResponse({ type: BoardResponseDto })
  public async create(
    @CurrentUser() user: CurrentUserModel,
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateBoardDto,
  ): Promise<BoardResponseDto> {
    const board = await this.boards.create(workspaceId, user.id, body);
    return toBoardResponse(board);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List boards in a workspace' })
  @ApiOkResponse({ type: [BoardResponseDto] })
  public async list(
    @CurrentUser() user: CurrentUserModel,
    @Param('workspaceId') workspaceId: string,
  ): Promise<BoardResponseDto[]> {
    const list = await this.boards.listByWorkspace(workspaceId, user.id);
    return list.map(toBoardResponse);
  }

  @Get(':boardId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get board by ID' })
  @ApiOkResponse({ type: BoardResponseDto })
  @ApiNotFoundResponse()
  public async getById(
    @Param('boardId') boardId: string,
  ): Promise<BoardResponseDto> {
    const board = await this.boards.getById(boardId);
    return toBoardResponse(board);
  }

  @Patch(':boardId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update board' })
  @ApiOkResponse({ type: BoardResponseDto })
  public async update(
    @CurrentUser() user: CurrentUserModel,
    @Param('boardId') boardId: string,
    @Body() body: UpdateBoardDto,
  ): Promise<BoardResponseDto> {
    const board = await this.boards.update(boardId, user.id, body);
    return toBoardResponse(board);
  }

  @Post(':boardId/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive board' })
  public async archive(
    @CurrentUser() user: CurrentUserModel,
    @Param('boardId') boardId: string,
  ): Promise<void> {
    await this.boards.archive(boardId, user.id);
  }

  @Post(':boardId/unarchive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unarchive board' })
  public async unarchive(
    @CurrentUser() user: CurrentUserModel,
    @Param('boardId') boardId: string,
  ): Promise<void> {
    await this.boards.unarchive(boardId, user.id);
  }

  @Delete(':boardId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete board' })
  public async delete(
    @CurrentUser() user: CurrentUserModel,
    @Param('boardId') boardId: string,
  ): Promise<void> {
    await this.boards.delete(boardId, user.id);
  }

  @Get(':boardId/columns')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List columns in a board' })
  @ApiOkResponse({ type: [BoardColumnResponseDto] })
  public async getColumns(
    @CurrentUser() user: CurrentUserModel,
    @Param('boardId') boardId: string,
  ): Promise<BoardColumnResponseDto[]> {
    const columns = await this.boards.getColumns(boardId, user.id);
    return columns.map(toColumnResponse);
  }

  @Post(':boardId/columns')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a column in a board' })
  @ApiCreatedResponse({ type: BoardColumnResponseDto })
  public async createColumn(
    @CurrentUser() user: CurrentUserModel,
    @Param('boardId') boardId: string,
    @Body() body: CreateColumnDto,
  ): Promise<BoardColumnResponseDto> {
    const column = await this.boards.createColumn(boardId, user.id, body);
    return toColumnResponse(column);
  }

  @Patch(':boardId/columns/:columnId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a column' })
  @ApiOkResponse({ type: BoardColumnResponseDto })
  public async updateColumn(
    @CurrentUser() user: CurrentUserModel,
    @Param('columnId') columnId: string,
    @Body() body: UpdateColumnDto,
  ): Promise<BoardColumnResponseDto> {
    const column = await this.boards.updateColumn(columnId, user.id, body);
    return toColumnResponse(column);
  }

  @Post(':boardId/columns/:columnId/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a column' })
  public async archiveColumn(
    @CurrentUser() user: CurrentUserModel,
    @Param('columnId') columnId: string,
  ): Promise<void> {
    await this.boards.archiveColumn(columnId, user.id);
  }
}

function toBoardResponse(b: {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  position: number;
  status: unknown;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): BoardResponseDto {
  return {
    id: b.id,
    workspaceId: b.workspaceId,
    name: b.name,
    description: b.description,
    position: b.position,
    status: b.status as BoardResponseDto['status'],
    archivedAt: b.archivedAt,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

function toColumnResponse(c: {
  id: string;
  boardId: string;
  name: string;
  position: number;
  status: unknown;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): BoardColumnResponseDto {
  return {
    id: c.id,
    boardId: c.boardId,
    name: c.name,
    position: c.position,
    status: c.status as string,
    archivedAt: c.archivedAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}
