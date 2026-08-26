export interface StoredObject {
  storageKey: string;
}

/**
 * Backend-agnostic blob storage. Implementations must treat `workspaceId`
 * as untrusted input (validate before building paths/keys) and must never
 * return publicly guessable URLs — downloads go through
 * {@link getDownloadUrl}, which for S3-compatible backends yields a
 * short-lived presigned URL and for local dev an authenticated API route.
 */
export interface StorageProvider {
  save(
    workspaceId: string,
    fileName: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StoredObject>;

  delete(storageKey: string): Promise<void>;

  /**
   * A fresh, access-controlled download URL for the object. Called on
   * every read; implementations may return short-lived signed URLs, so
   * callers must not persist the result.
   */
  getDownloadUrl(
    storageKey: string,
    originalName: string,
    mimeType?: string,
  ): Promise<string>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
