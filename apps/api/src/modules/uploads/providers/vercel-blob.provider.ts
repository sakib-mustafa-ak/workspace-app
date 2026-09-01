import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { del, issueSignedToken, presignUrl, put } from '@vercel/blob';

import { isUuid } from '../../../common/utils/is-uuid.js';

import type {
  StorageProvider,
  StoredObject,
} from '../interfaces/storage-provider.interface';

const PRESIGN_TTL_SECONDS = 300;

/**
 * Keep only the basename of a client-supplied filename and strip any path
 * separators, so `originalname` can never create nested/escaped pathname
 * segments in the blob store.
 */
function safeName(fileName: string): string {
  const base = basename(fileName ?? 'file')
    .replace(/[\\/]/g, '_')
    .replace(/[^\w.\- ]/g, '')
    .slice(0, 100)
    .trim();
  return base || 'file';
}

interface BlobSdk {
  put: typeof put;
  del: typeof del;
  issueSignedToken: typeof issueSignedToken;
  presignUrl: typeof presignUrl;
}

const DEFAULT_SDK: BlobSdk = { put, del, issueSignedToken, presignUrl };

/**
 * Vercel Blob storage provider.
 *
 * Access model: `private` blobs + short-lived signed GET URLs. Public blobs
 * are "anyone with the URL" — that would reintroduce the auth-less serving
 * the uploads hardening removed (every download must go through an
 * access-controlled {@link getDownloadUrl}, exactly like the S3 provider's
 * presigned URL and the local provider's authenticated route). Signed URLs
 * are time-limited and scoped to a single pathname, never persisting.
 *
 * Auth is the single `BLOB_READ_WRITE_TOKEN`, passed explicitly to every SDK
 * call so the provider works outside Vercel too (e.g. the Render host). A
 * missing token fails at env validation/boot, not at first upload.
 */
@Injectable()
export class VercelBlobStorageProvider implements StorageProvider {
  private readonly token?: string;
  private readonly sdk: BlobSdk;

  constructor(configService: ConfigService, sdk: BlobSdk = DEFAULT_SDK) {
    const blob = configService.get<{ token: string }>('storage.blob');
    // Guarded by env validation at boot; unreachable when configured.
    this.token = blob?.token;
    this.sdk = sdk;
  }

  async save(
    workspaceId: string,
    fileName: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StoredObject> {
    if (!isUuid(workspaceId)) {
      throw new Error('Invalid workspace id for storage key.');
    }

    // A UUID prefix makes collisions effectively impossible, so blobs are
    // written to a single fixed pathname (no random suffix) that we store
    // verbatim as the storageKey.
    const pathname = `${workspaceId}/${randomUUID()}-${safeName(fileName)}`;
    await this.sdk.put(pathname, buffer, {
      access: 'private',
      contentType: mimeType,
      addRandomSuffix: false,
      token: this.token,
    });
    return { storageKey: pathname };
  }

  async delete(storageKey: string): Promise<void> {
    await this.sdk.del(storageKey, { token: this.token }).catch(() => {});
  }

  async getDownloadUrl(
    storageKey: string,
    _originalName: string,
    _mimeType?: string,
  ): Promise<string> {
    void _originalName;

    void _mimeType;
    const validUntil = Date.now() + PRESIGN_TTL_SECONDS * 1000;
    const signedToken = await this.sdk.issueSignedToken({
      pathname: storageKey,
      operations: ['get'],
      validUntil,
      token: this.token,
    });
    const { presignedUrl } = await this.sdk.presignUrl(signedToken, {
      operation: 'get',
      pathname: storageKey,
      access: 'private',
      validUntil,
    });
    return presignedUrl;
  }
}
