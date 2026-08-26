import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { isUuid } from '../../../common/utils/is-uuid.js';

import type {
  StorageProvider,
  StoredObject,
} from '../interfaces/storage-provider.interface';

const PRESIGN_TTL_SECONDS = 300;

/**
 * MIME types that browsers may execute when rendered inline. These are
 * always served with `Content-Disposition: attachment` so a hostile
 * upload can never run script in our origin.
 */
const ATTACHMENT_ONLY = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
]);

function dispositionFor(mimeType: string, originalName: string): string {
  return ATTACHMENT_ONLY.has(mimeType.toLowerCase())
    ? `attachment; filename="${encodeURIComponent(originalName)}"`
    : 'inline';
}

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(configService: ConfigService) {
    const s3 = configService.get<{
      endpoint: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
    }>('storage.s3');

    if (!s3) {
      // Guarded by env validation at boot; unreachable when configured.
      throw new Error(
        'STORAGE_DRIVER=s3 requires the S3_* environment variables.',
      );
    }

    this.bucket = s3.bucket;
    this.client = new S3Client({
      endpoint: s3.endpoint,
      region: s3.region,
      credentials: {
        accessKeyId: s3.accessKeyId,
        secretAccessKey: s3.secretAccessKey,
      },
    });
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

    const storageKey = `${workspaceId}/${randomUUID()}-${fileName.replace(/[^\w.\- ]/g, '').slice(0, 100)}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
        // Never let a stored object render script on our origins.
        ContentDisposition: dispositionFor(mimeType, fileName),
      }),
    );
    return { storageKey };
  }

  async delete(storageKey: string): Promise<void> {
    await this.client
      .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }))
      .catch(() => {});
  }

  async getDownloadUrl(
    storageKey: string,
    originalName: string,
    mimeType?: string,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ResponseContentDisposition: dispositionFor(
        mimeType ?? '',
        originalName || 'download',
      ),
    });
    return getSignedUrl(this.client, command, {
      expiresIn: PRESIGN_TTL_SECONDS,
    });
  }
}
