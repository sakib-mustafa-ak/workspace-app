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

import { CanvasService } from '../services/canvas.service';
import { CreateCanvasObjectDto } from '../dto/create-object.dto';
import { UpdateCanvasObjectDto } from '../dto/update-object.dto';
import {
  CanvasObjectResponseDto,
  CanvasResponseDto,
} from '../dto/canvas-response.dto';
import type { CanvasObjectRow } from '@repo/database';
import { WorkspaceAccess } from '../../../common/decorators/workspace-access.decorator';

@ApiTags('Canvas')
@ApiBearerAuth()
@WorkspaceAccess('VIEWER')
@Controller({ path: 'boards/:boardId/canvas', version: '1' })
export class CanvasController {
  constructor(@Inject(CanvasService) private readonly canvas: CanvasService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get or create canvas for a board' })
  @ApiOkResponse({ type: CanvasResponseDto })
  public async getCanvas(
    @CurrentUser() user: CurrentUserModel,
    @Param('boardId') boardId: string,
  ): Promise<CanvasResponseDto> {
    const { canvas: c, objects } = await this.canvas.getOrCreateCanvas(
      boardId,
      user.id,
    );
    return {
      id: c.id,
      boardId: c.boardId,
      workspaceId: c.workspaceId,
      name: c.name,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      objects: objects.map(toObjectResponse),
    };
  }

  @Post('objects')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a canvas object' })
  @ApiCreatedResponse({ type: CanvasObjectResponseDto })
  public async createObject(
    @CurrentUser() user: CurrentUserModel,
    @Param('boardId') boardId: string,
    @Body() body: CreateCanvasObjectDto,
  ): Promise<CanvasObjectResponseDto> {
    const obj = await this.canvas.createObject(boardId, user.id, body);
    return toObjectResponse(obj);
  }

  @Patch('objects/:objectId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a canvas object' })
  @ApiOkResponse({ type: CanvasObjectResponseDto })
  public async updateObject(
    @CurrentUser() user: CurrentUserModel,
    @Param('boardId') boardId: string,
    @Param('objectId') objectId: string,
    @Body() body: UpdateCanvasObjectDto,
  ): Promise<CanvasObjectResponseDto> {
    const obj = await this.canvas.updateObject(
      boardId,
      objectId,
      user.id,
      body,
    );
    return toObjectResponse(obj);
  }

  @Delete('objects/:objectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a canvas object' })
  public async deleteObject(
    @CurrentUser() user: CurrentUserModel,
    @Param('boardId') boardId: string,
    @Param('objectId') objectId: string,
  ): Promise<void> {
    await this.canvas.deleteObject(boardId, objectId, user.id);
  }
}

function toObjectResponse(o: CanvasObjectRow): CanvasObjectResponseDto {
  return {
    id: o.id,
    canvasId: o.canvasId,
    parentId: o.parentId,
    type: o.type,
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
    rotation: o.rotation,
    zIndex: o.zIndex,
    fill: o.fill,
    stroke: o.stroke,
    strokeWidth: o.strokeWidth,
    opacity: o.opacity,
    data: o.data as Record<string, unknown> | null | undefined,
    createdById: o.createdById,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}
