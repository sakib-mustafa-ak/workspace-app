export interface StorageProvider {
  save(
    workspaceId: string,
    fileName: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ storageKey: string; url: string }>;

  delete(storageKey: string): Promise<void>;

  getUrl(storageKey: string): string;
}
