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

import { CommentsService } from '../services/comments.service';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { UpdateCommentDto } from '../dto/update-comment.dto';
import { CommentResponseDto } from '../dto/comment-response.dto';

@ApiTags('Comments')
@ApiBearerAuth()
@Controller({ path: 'boards/:boardId/comments', version: '1' })
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a comment on a board' })
  @ApiCreatedResponse({ type: CommentResponseDto })
  public async create(
    @CurrentUser() user: CurrentUserModel,
    @Param('boardId') boardId: string,
    @Body() body: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const comment = await this.comments.create(boardId, user.id, body);
    return toCommentResponse(comment);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List comments on a board' })
  @ApiOkResponse({ type: [CommentResponseDto] })
  public async list(
    @CurrentUser() user: CurrentUserModel,
    @Param('boardId') boardId: string,
  ): Promise<CommentResponseDto[]> {
    const list = await this.comments.listByBoard(boardId, user.id);
    return list.map(toCommentResponse);
  }

  @Get(':commentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get comment by ID' })
  @ApiOkResponse({ type: CommentResponseDto })
  @ApiNotFoundResponse()
  public async getById(
    @Param('commentId') commentId: string,
  ): Promise<CommentResponseDto> {
    const comment = await this.comments.getById(commentId);
    return toCommentResponse(comment);
  }

  @Patch(':commentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update comment' })
  @ApiOkResponse({ type: CommentResponseDto })
  public async update(
    @CurrentUser() user: CurrentUserModel,
    @Param('commentId') commentId: string,
    @Body() body: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    const comment = await this.comments.update(commentId, user.id, body);
    return toCommentResponse(comment);
  }

  @Delete(':commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete comment' })
  public async delete(
    @CurrentUser() user: CurrentUserModel,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    await this.comments.delete(commentId, user.id);
  }
}

function toCommentResponse(c: {
  id: string;
  boardId: string;
  workspaceId: string;
  parentId: string | null;
  content: string;
  userId: string;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CommentResponseDto {
  return {
    id: c.id,
    boardId: c.boardId,
    workspaceId: c.workspaceId,
    parentId: c.parentId,
    content: c.content,
    userId: c.userId,
    editedAt: c.editedAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}
