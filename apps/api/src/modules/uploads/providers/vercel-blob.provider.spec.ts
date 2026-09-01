import { ConfigService } from '@nestjs/config';

import { VercelBlobStorageProvider } from './vercel-blob.provider';

import type { IssuedSignedToken, PutBlobResult } from '@vercel/blob';

const WORKSPACE_ID = 'abcd1234-abcd-4234-8abc-abcdefabcdef';

function createConfig(token?: string) {
  return {
    get: jest.fn((key: string) => {
      if (key === 'storage.blob') {
        return token ? { token } : null;
      }
      return undefined;
    }),
  } as unknown as ConfigService;
}

function createSdk() {
  return {
    put: jest.fn<
      Promise<PutBlobResult>,
      Parameters<typeof import('@vercel/blob').put>
    >(),
    del: jest.fn<
      Promise<void>,
      Parameters<typeof import('@vercel/blob').del>
    >(),
    issueSignedToken: jest.fn<
      Promise<IssuedSignedToken>,
      Parameters<typeof import('@vercel/blob').issueSignedToken>
    >(),
    presignUrl: jest.fn<
      Promise<{ presignedUrl: string }>,
      Parameters<typeof import('@vercel/blob').presignUrl>
    >(),
  };
}

describe('VercelBlobStorageProvider', () => {
  it('saves to a pathname built from the workspace id and a safe filename', async () => {
    const sdk = createSdk();
    sdk.put.mockResolvedValue({
      url: 'https://store.private.blob.vercel-storage.com/ws/file.png',
      downloadUrl: 'https://store.private.blob.vercel-storage.com/ws/file.png',
      pathname: `${WORKSPACE_ID}/file.png`,
      contentType: 'image/png',
      contentDisposition: 'inline',
      etag: 'etag',
    });
    const provider = new VercelBlobStorageProvider(createConfig('tok'), sdk);

    const result = await provider.save(
      WORKSPACE_ID,
      'report.png',
      Buffer.from('x'),
      'image/png',
    );

    expect(result.storageKey).toMatch(
      new RegExp(`^${WORKSPACE_ID}/[0-9a-f-]{36}-report\\.png$`),
    );
    expect(sdk.put).toHaveBeenCalledWith(
      result.storageKey,
      Buffer.from('x'),
      expect.objectContaining({
        access: 'private',
        contentType: 'image/png',
        addRandomSuffix: false,
        token: 'tok',
      }),
    );
  });

  it('rejects an invalid (non-UUID) workspace id before touching the SDK', async () => {
    const sdk = createSdk();
    const provider = new VercelBlobStorageProvider(createConfig('tok'), sdk);

    await expect(
      provider.save('../../etc', 'evil.png', Buffer.from('x'), 'image/png'),
    ).rejects.toThrow('Invalid workspace id for storage key.');
    expect(sdk.put).not.toHaveBeenCalled();
  });

  it('sanitizes a filename so it cannot escape the intended pathname', async () => {
    const sdk = createSdk();
    sdk.put.mockResolvedValue({
      url: 'u',
      downloadUrl: 'u',
      pathname: 'x',
      contentType: 'text/plain',
      contentDisposition: 'attachment',
      etag: 'etag',
    });
    const provider = new VercelBlobStorageProvider(createConfig('tok'), sdk);

    await provider.save(
      WORKSPACE_ID,
      '../../../etc/passwd',
      Buffer.from('x'),
      'text/plain',
    );

    const [pathname] = sdk.put.mock.calls[0] as [string, unknown, unknown];
    expect(pathname).toMatch(new RegExp(`^${WORKSPACE_ID}/`));
    expect(pathname).not.toContain('..');
    // Only the workspace-id separator is allowed; the basename segment must
    // contain no further separators that could escape the intended pathname.
    const [, basenamePart] = pathname.split('/') as [string, string];
    expect(basenamePart).not.toContain('/');
    expect(basenamePart).toMatch(/passwd\.?$/);
  });

  it('deletes by storage key with the configured token, swallowing errors', async () => {
    const sdk = createSdk();
    sdk.del.mockRejectedValue(new Error('gone'));
    const provider = new VercelBlobStorageProvider(createConfig('tok'), sdk);

    await expect(provider.delete('ws-id/file.png')).resolves.toBeUndefined();
    expect(sdk.del).toHaveBeenCalledWith(
      'ws-id/file.png',
      expect.objectContaining({ token: 'tok' }),
    );
  });

  it('returns a short-lived signed private GET URL for downloads', async () => {
    const sdk = createSdk();
    sdk.issueSignedToken.mockResolvedValue({
      delegationToken: 'd',
      clientSigningToken: 's',
      validUntil: 0,
    });
    sdk.presignUrl.mockResolvedValue({
      presignedUrl: 'https://signed.example/file?x=1',
    });
    const provider = new VercelBlobStorageProvider(createConfig('tok'), sdk);

    const url = await provider.getDownloadUrl(
      'ws-id/file.png',
      'file.png',
      'image/png',
    );

    expect(url).toBe('https://signed.example/file?x=1');
    expect(sdk.issueSignedToken).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: 'ws-id/file.png',
        operations: ['get'],
        token: 'tok',
      }),
    );
    const issued = sdk.issueSignedToken.mock.calls[0][0] as {
      validUntil: number;
    };
    expect(issued.validUntil).toBeGreaterThan(Date.now());
    expect(sdk.presignUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        delegationToken: 'd',
        clientSigningToken: 's',
      }),
      expect.objectContaining({
        operation: 'get',
        pathname: 'ws-id/file.png',
        access: 'private',
      }),
    );
  });

  it('constructs even when the token is missing (boot validation catches it)', () => {
    const provider = new VercelBlobStorageProvider(
      createConfig(undefined),
      createSdk(),
    );
    expect(provider).toBeInstanceOf(VercelBlobStorageProvider);
  });
});
