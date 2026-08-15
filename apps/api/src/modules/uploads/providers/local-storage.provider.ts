import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';

import type { StorageProvider } from '../interfaces/storage-provider.interface';

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
  ): Promise<{ storageKey: string; url: string }> {
    const key = `${workspaceId}/${randomUUID()}-${safeName(fileName)}`;
    const dir = join(UPLOAD_DIR, workspaceId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(UPLOAD_DIR, key), buffer);
    return {
      storageKey: key,
      url: `/uploads/${key}`,
    };
  }

  async delete(storageKey: string): Promise<void> {
    await unlink(join(UPLOAD_DIR, storageKey)).catch(() => {});
  }

  getUrl(storageKey: string): string {
    return `/uploads/${storageKey}`;
  }
}
