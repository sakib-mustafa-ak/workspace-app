import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PluginProviderService } from './plugin-provider.service';

describe('plugin providers', () => {
  const service = new PluginProviderService(
    new ConfigService({
      app: { publicBaseUrl: 'https://workspace.example.test' },
      plugins: {
        encryptionKey: Buffer.alloc(32).toString('base64'),
        github: { clientId: 'github-test', clientSecret: 'secret-test' },
        slack: { clientId: 'slack-test', clientSecret: 'secret-test' },
        google: { clientId: 'google-test', clientSecret: 'secret-test' },
      },
    }),
  );
  afterEach(() => jest.restoreAllMocks());

  it('keeps unconfigured providers unavailable without breaking add-ons', () => {
    const unconfigured = new PluginProviderService(new ConfigService({}));
    expect(unconfigured.ready('github')).toBe(false);
    expect(() =>
      unconfigured.authorizationUrl('github', 'state', 'verifier'),
    ).toThrow();
  });

  it.each(['github', 'slack', 'google-calendar'] as const)(
    'uses narrow scopes and fixed %s endpoints',
    (provider) => {
      const url = new URL(
        service.authorizationUrl(provider, 'state', 'verifier'),
      );
      expect(url.searchParams.get('state')).toBe('state');
      expect(url.searchParams.get('redirect_uri')).toBe(
        `https://workspace.example.test/plugins/callback/${provider}`,
      );
      expect(url.searchParams.has('client_secret')).toBe(false);
      expect(url.searchParams.get('scope')).toBe(
        provider === 'github'
          ? ''
          : provider === 'slack'
            ? 'channels:read,chat:write'
            : 'https://www.googleapis.com/auth/calendar.events.readonly',
      );
      if (provider !== 'slack')
        expect(url.searchParams.get('code_challenge')).toBe(
          createHash('sha256').update('verifier').digest('base64url'),
        );
    },
  );

  it('does not expose provider errors or follow redirects', async () => {
    const mock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json({ ok: false, error: 'private-access-token' }),
      );
    await expect(service.exchange('slack', 'code', 'verifier')).rejects.toThrow(
      'The provider could not complete',
    );
    expect(mock.mock.calls[0][1]).toMatchObject({
      redirect: 'error',
      method: 'POST',
    });
  });

  it('rejects repository path traversal without making a request', async () => {
    const mock = jest.spyOn(globalThis, 'fetch');
    for (const repository of [
      '../user',
      'demo/..',
      'demo/.',
      'https://evil.test/a',
      'demo/repo?x=1',
    ]) {
      await expect(
        service.data('github', { accessToken: 'test' }, repository),
      ).rejects.toThrow();
    }
    expect(mock).not.toHaveBeenCalled();
  });

  it('does not refresh unexpired tokens and reports missing refresh credentials', async () => {
    const tokens = { accessToken: 'test', expiresAt: Date.now() + 3600_000 };
    expect(await service.refresh('github', tokens)).toBe(tokens);
    await expect(
      service.refresh('github', { accessToken: 'test', expiresAt: 1 }),
    ).rejects.toThrow('Reconnect');
  });
});
