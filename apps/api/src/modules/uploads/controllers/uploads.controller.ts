import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserModel } from '../../auth/interfaces/current-user.interface';

import { UploadsService } from '../services/uploads.service';
import { UploadResponseDto } from '../dto/upload-response.dto';

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller({ path: 'workspaces/:workspaceId/uploads', version: '1' })
export class UploadsController {
  constructor(
    @Inject(UploadsService) private readonly uploads: UploadsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        boardId: { type: 'string' },
      },
    },
  })
  @ApiCreatedResponse({ type: UploadResponseDto })
  public async upload(
    @CurrentUser() user: CurrentUserModel,
    @Param('workspaceId') workspaceId: string,
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    @Body('boardId') boardId?: string,
  ): Promise<UploadResponseDto> {
    const upload = await this.uploads.upload(
      workspaceId,
      user.id,
      boardId,
      file,
    );
    return toUploadResponse(upload);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List uploads in workspace' })
  @ApiOkResponse({ type: [UploadResponseDto] })
  public async listByWorkspace(
    @CurrentUser() user: CurrentUserModel,
    @Param('workspaceId') workspaceId: string,
  ): Promise<UploadResponseDto[]> {
    const list = await this.uploads.listByWorkspace(workspaceId, user.id);
    return list.map(toUploadResponse);
  }

  @Get('boards/:boardId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List uploads for a board' })
  @ApiOkResponse({ type: [UploadResponseDto] })
  public async listByBoard(
    @CurrentUser() user: CurrentUserModel,
    @Param('boardId') boardId: string,
  ): Promise<UploadResponseDto[]> {
    const list = await this.uploads.listByBoard(boardId, user.id);
    return list.map(toUploadResponse);
  }

  @Delete(':uploadId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an upload' })
  public async delete(
    @CurrentUser() user: CurrentUserModel,
    @Param('uploadId') uploadId: string,
  ): Promise<void> {
    await this.uploads.delete(uploadId, user.id);
  }
}

function toUploadResponse(u: {
  id: string;
  workspaceId: string;
  boardId: string | null;
  userId: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  provider: string;
  createdAt: Date;
}): UploadResponseDto {
  return {
    id: u.id,
    workspaceId: u.workspaceId,
    boardId: u.boardId,
    userId: u.userId,
    originalName: u.originalName,
    mimeType: u.mimeType,
    size: u.size,
    url: u.url,
    provider: u.provider,
    createdAt: u.createdAt,
  };
}
