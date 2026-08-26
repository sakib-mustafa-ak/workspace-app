import { Inject, Injectable } from '@nestjs/common';

import { BoardsRepository } from '../../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';

import { UploadsRepository } from '../repositories/uploads.repository';
import { UploadsEventBus } from '../events/uploads.events';
import { UploadPolicy } from '../policies/upload.policy';
import { UploadException, UploadErrorCode } from '../errors/uploads.errors';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../interfaces/storage-provider.interface';
import type { UploadedFileRow } from '@repo/database';

export interface EnrichedUpload extends UploadedFileRow {
  downloadUrl: string;
}

@Injectable()
export class UploadsService {
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  /**
   * SVG is deliberately NOT on the allowlist: it can carry executable
   * script, and every sanitization approach leaks. Legacy SVG objects
   * uploaded before this rule are still downloadable but are forced
   * into an attachment disposition by the storage layer.
   */
  private static readonly ALLOWED_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/json',
  ]);

  constructor(
    @Inject(UploadsRepository) private readonly uploadsRepo: UploadsRepository,
    @Inject(BoardsRepository) private readonly boardsRepo: BoardsRepository,
    @Inject(WorkspaceMembersRepository)
    private readonly membersRepo: WorkspaceMembersRepository,
    @Inject(UploadsEventBus) private readonly eventBus: UploadsEventBus,
    @Inject(UploadPolicy) private readonly policy: UploadPolicy,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async upload(
    workspaceId: string,
    userId: string,
    boardId: string | undefined,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ) {
    const membership = await this.membersRepo.findByWorkspaceAndUser(
      workspaceId,
      userId,
    );
    if (!membership) {
      throw new UploadException(
        UploadErrorCode.NOT_A_MEMBER,
        'Not a workspace member',
      );
    }
    if (!this.policy.canUpload(membership.role)) {
      throw new UploadException(
        UploadErrorCode.INSUFFICIENT_ROLE,
        'Insufficient role',
      );
    }

    if (file.size > UploadsService.MAX_FILE_SIZE) {
      throw new UploadException(
        UploadErrorCode.FILE_TOO_LARGE,
        'File exceeds the 10 MB size limit',
      );
    }

    const mimeType = file.mimetype?.toLowerCase() ?? '';
    if (!UploadsService.ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new UploadException(
        UploadErrorCode.INVALID_MIME_TYPE,
        'File type is not allowed',
      );
    }

    if (boardId) {
      const board = await this.boardsRepo.findById(boardId);
      if (!board) {
        throw new UploadException(
          UploadErrorCode.BOARD_NOT_FOUND,
          'Board not found',
        );
      }
      if (board.workspaceId !== workspaceId) {
        throw new UploadException(
          UploadErrorCode.BOARD_NOT_FOUND,
          'Board does not belong to workspace',
        );
      }
    }

    const { storageKey } = await this.storage.save(
      workspaceId,
      file.originalname,
      file.buffer,
      mimeType,
    );

    const upload = await this.uploadsRepo.create({
      workspaceId,
      boardId: boardId ?? null,
      userId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storageKey,
      url: '',
      provider: 'storage',
    });

    this.eventBus.publishFileUploaded({
      fileId: upload.id,
      workspaceId,
      boardId,
      userId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });

    return this.enrich(upload);
  }

  async listByBoard(boardId: string, userId: string) {
    const board = await this.boardsRepo.findById(boardId);
    if (!board) {
      throw new UploadException(
        UploadErrorCode.BOARD_NOT_FOUND,
        'Board not found',
      );
    }
    const membership = await this.membersRepo.findByWorkspaceAndUser(
      board.workspaceId,
      userId,
    );
    if (!membership) {
      throw new UploadException(
        UploadErrorCode.NOT_A_MEMBER,
        'Not a workspace member',
      );
    }
    if (!this.policy.canView(membership.role)) {
      throw new UploadException(
        UploadErrorCode.INSUFFICIENT_ROLE,
        'Insufficient role',
      );
    }
    return this.enrichAll(await this.uploadsRepo.findByBoard(boardId));
  }

  async listByWorkspace(workspaceId: string, userId: string) {
    const membership = await this.membersRepo.findByWorkspaceAndUser(
      workspaceId,
      userId,
    );
    if (!membership) {
      throw new UploadException(
        UploadErrorCode.NOT_A_MEMBER,
        'Not a workspace member',
      );
    }
    if (!this.policy.canView(membership.role)) {
      throw new UploadException(
        UploadErrorCode.INSUFFICIENT_ROLE,
        'Insufficient role',
      );
    }
    return this.enrichAll(await this.uploadsRepo.findByWorkspace(workspaceId));
  }

  async delete(id: string, userId: string) {
    const upload = await this.uploadsRepo.findById(id);
    if (!upload) {
      throw new UploadException(
        UploadErrorCode.UPLOAD_NOT_FOUND,
        'Upload not found',
      );
    }
    const membership = await this.membersRepo.findByWorkspaceAndUser(
      upload.workspaceId,
      userId,
    );
    if (!membership) {
      throw new UploadException(
        UploadErrorCode.NOT_A_MEMBER,
        'Not a workspace member',
      );
    }
    if (!this.policy.canManage(membership.role)) {
      throw new UploadException(
        UploadErrorCode.INSUFFICIENT_ROLE,
        'Insufficient role',
      );
    }

    await this.storage.delete(upload.storageKey);
    await this.uploadsRepo.softDelete(id);

    this.eventBus.publishFileDeleted({
      fileId: id,
      workspaceId: upload.workspaceId,
      deletedBy: userId,
    });
  }

  /**
   * Download URLs are short-lived (or at least access-checked) and must
   * never be trusted from the stored row — always mint them fresh.
   */
  private async enrich(upload: UploadedFileRow): Promise<EnrichedUpload> {
    return {
      ...upload,
      downloadUrl: await this.storage.getDownloadUrl(
        upload.storageKey,
        upload.originalName,
        upload.mimeType,
      ),
    };
  }

  private enrichAll(rows: UploadedFileRow[]): Promise<EnrichedUpload[]> {
    return Promise.all(rows.map((row) => this.enrich(row)));
  }
}
