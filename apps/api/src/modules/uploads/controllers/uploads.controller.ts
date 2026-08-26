import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserModel } from '../../auth/interfaces/current-user.interface';

import { UploadsService } from '../services/uploads.service';
import { UploadResponseDto } from '../dto/upload-response.dto';
import { WorkspaceAccess } from '../../../common/decorators/workspace-access.decorator';
import { isUuid } from '../../../common/utils/is-uuid.js';

const ATTACHMENT_ONLY = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
]);

@ApiTags('Uploads')
@ApiBearerAuth()
@WorkspaceAccess('VIEWER')
@Controller({ path: 'workspaces/:workspaceId/uploads', version: '1' })
export class UploadsController {
  constructor(
    @Inject(UploadsService) private readonly uploads: UploadsService,
  ) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        boardId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiCreatedResponse({ type: UploadResponseDto })
  public async upload(
    @CurrentUser() user: CurrentUserModel,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          // Mirrors UploadsService.ALLOWED_MIME_TYPES — reject early so a
          // missing file returns 400 instead of a 500, and oversize files
          // are refused by multer before being buffered into memory.
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType:
              /^(image\/(png|jpeg|gif|webp)|application\/pdf|text\/(plain|markdown)|application\/json)$/,
          }),
        ],
      }),
    )
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    @Body('boardId') boardId?: string,
  ): Promise<UploadResponseDto> {
    if (boardId && !isUuid(boardId)) {
      throw new BadRequestException('boardId must be a UUID');
    }
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
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
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
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
  ): Promise<UploadResponseDto[]> {
    void workspaceId;
    const list = await this.uploads.listByBoard(boardId, user.id);
    return list.map(toUploadResponse);
  }

  /**
   * Authenticated local-file download. This replaces the former public
   * static mount at /uploads/** which served any user content to anyone
   * holding the URL. S3-backed deployments never hit this route — they
   * receive presigned URLs instead.
   */
  @Get('file/*splat')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({ summary: 'Download an upload (local storage only)' })
  public async download(
    @CurrentUser() user: CurrentUserModel,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('splat') storageKey: string,
    @Res() res: Response,
  ): Promise<void> {
    const decoded = decodeURIComponent(storageKey);
    // Defense in depth beyond the membership check below: the key must
    // live inside this workspace's prefix and contain no traversal.
    if (
      !decoded.startsWith(`${workspaceId}/`) ||
      decoded.includes('..') ||
      decoded.includes('\0')
    ) {
      res.status(HttpStatus.FORBIDDEN).json({
        error: { code: 'UPLOAD.NOT_FOUND', message: 'Upload not found' },
      });
      return;
    }

    const list = await this.uploads.listByWorkspace(workspaceId, user.id);
    const match = list.find((u) => u.storageKey === decoded);
    if (!match) {
      res.status(HttpStatus.NOT_FOUND).json({
        error: { code: 'UPLOAD.NOT_FOUND', message: 'Upload not found' },
      });
      return;
    }

    const filePath = join(process.cwd(), 'uploads', decoded);
    try {
      const stats = await stat(filePath);
      const inlineSafe = !ATTACHMENT_ONLY.has(match.mimeType.toLowerCase());
      res.setHeader(
        'Content-Type',
        inlineSafe ? match.mimeType : 'application/octet-stream',
      );
      // SVG and friends download instead of rendering — no script execution.
      res.setHeader(
        'Content-Disposition',
        `${inlineSafe ? 'inline' : 'attachment'}; filename="${encodeURIComponent(basename(match.originalName))}"`,
      );
      res.setHeader('Content-Length', String(stats.size));
      createReadStream(filePath).pipe(res.status(HttpStatus.OK));
    } catch {
      res.status(HttpStatus.NOT_FOUND).json({
        error: { code: 'UPLOAD.NOT_FOUND', message: 'Upload not found' },
      });
    }
  }

  @Delete(':uploadId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an upload' })
  public async delete(
    @CurrentUser() user: CurrentUserModel,
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
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
  downloadUrl?: string;
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
    downloadUrl: u.downloadUrl ?? '',
    provider: u.provider,
    createdAt: u.createdAt,
  };
}
