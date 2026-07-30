import { Inject, Injectable } from '@nestjs/common';

import {
  DATABASE,
  desc,
  eq,
  sql,
  type Db,
  type NewUploadedFileRow,
  type UploadedFileRow,
  uploadedFiles,
} from '@repo/database';

@Injectable()
export class UploadsRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async findById(id: string): Promise<UploadedFileRow | undefined> {
    const [row] = await this.db
      .select()
      .from(uploadedFiles)
      .where(
        sql`${uploadedFiles.id} = ${id} AND ${uploadedFiles.deletedAt} IS NULL`,
      )
      .limit(1);
    return row;
  }

  async findByBoard(boardId: string): Promise<UploadedFileRow[]> {
    return this.db
      .select()
      .from(uploadedFiles)
      .where(
        sql`${uploadedFiles.boardId} = ${boardId} AND ${uploadedFiles.deletedAt} IS NULL`,
      )
      .orderBy(desc(uploadedFiles.createdAt));
  }

  async findByWorkspace(workspaceId: string): Promise<UploadedFileRow[]> {
    return this.db
      .select()
      .from(uploadedFiles)
      .where(
        sql`${uploadedFiles.workspaceId} = ${workspaceId} AND ${uploadedFiles.deletedAt} IS NULL`,
      )
      .orderBy(desc(uploadedFiles.createdAt));
  }

  async create(data: NewUploadedFileRow): Promise<UploadedFileRow> {
    const [row] = await this.db.insert(uploadedFiles).values(data).returning();
    if (!row) throw new Error('Failed to create upload.');
    return row;
  }

  async softDelete(id: string): Promise<void> {
    await this.db
      .update(uploadedFiles)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(uploadedFiles.id, id));
  }
}
