import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { isUuid } from '../../../common/utils/is-uuid.js';

import type {
  StorageProvider,
  StoredObject,
} from '../interfaces/storage-provider.interface';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

/**
 * Keep only the basename of a client-supplied filename and strip any
 * path separators, so `originalname` can never traverse out of the
 * uploads directory.
 */
function safeName(fileName: string): string {
  const base = basename(fileName ?? 'file')
    .replace(/[\\/]/g, '_')
    .replace(/[^\w.\- ]/g, '')
    .slice(0, 100)
    .trim();
  return base || 'file';
}

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  async save(
    workspaceId: string,
    fileName: string,
    buffer: Buffer,
    _mimeType: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<StoredObject> {
    // workspaceId is a route parameter by the time it reaches us — treat
    // it as untrusted before it touches a filesystem path.
    if (!isUuid(workspaceId)) {
      throw new Error('Invalid workspace id for storage key.');
    }

    const key = `${workspaceId}/${randomUUID()}-${safeName(fileName)}`;
    const dir = join(UPLOAD_DIR, workspaceId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(UPLOAD_DIR, key), buffer);
    return { storageKey: key };
  }

  async delete(storageKey: string): Promise<void> {
    await unlink(join(UPLOAD_DIR, storageKey)).catch(() => {});
  }

  /**
   * Dev-only download URL. Local files are served through the
   * authenticated uploads controller — the old unauthenticated static
   * mount is gone.
   */
  getDownloadUrl(storageKey: string, originalName: string): Promise<string> {
    const [workspaceId] = storageKey.split('/');
    void originalName;
    return Promise.resolve(
      `/api/v1/workspaces/${workspaceId}/uploads/file/${encodeURIComponent(storageKey)}`,
    );
  }
}
