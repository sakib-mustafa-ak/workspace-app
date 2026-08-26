import { Inject, Injectable } from '@nestjs/common';

import { BoardsRepository } from '../../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';

import { UploadsRepository } from '../repositories/uploads.repository';
import { UploadsEventBus } from '../events/uploads.events';
import { UploadPolicy } from '../policies/upload.policy';
import { UploadException, UploadErrorCode } from '../errors/uploads.errors';
import { LocalStorageProvider } from '../providers/local-storage.provider';

@Injectable()
export class UploadsService {
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  private static readonly ALLOWED_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
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
    @Inject(LocalStorageProvider)
    private readonly storage: LocalStorageProvider,
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

    const { storageKey, url } = await this.storage.save(
      workspaceId,
      file.originalname,
      file.buffer,
      file.mimetype,
    );

    const upload = await this.uploadsRepo.create({
      workspaceId,
      boardId: boardId ?? null,
      userId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storageKey,
      url,
      provider: 'local',
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

    return upload;
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
    return this.uploadsRepo.findByBoard(boardId);
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
    return this.uploadsRepo.findByWorkspace(workspaceId);
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
}
