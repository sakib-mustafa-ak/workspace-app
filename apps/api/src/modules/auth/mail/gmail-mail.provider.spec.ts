import { ConfigService } from '@nestjs/config';
import { GmailMailProvider } from './gmail-mail.provider';

describe('Gmail HTTPS transport', () => {
  let request: jest.SpyInstance<
    ReturnType<typeof fetch>,
    Parameters<typeof fetch>
  >;
  const config = () =>
    new ConfigService({
      mail: {
        from: 'Workspace OS <workspace.os.verify@gmail.com>',
        gmail: {
          user: 'workspace.os.verify@gmail.com',
          clientId: 'client-test',
          clientSecret: 'secret-test',
          refreshToken: 'refresh-test',
        },
      },
    });
  const message = {
    to: 'recipient@example.com',
    subject: 'Verify your email',
    text: 'Verification link',
    html: '<p>Verification link</p>',
  };
  const tokenResponse = () =>
    new Response(
      JSON.stringify({ access_token: 'access-test', expires_in: 3600 }),
    );
  const sentResponse = () =>
    new Response(JSON.stringify({ id: 'gmail-message-test' }));
  beforeEach(() => {
    request = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());

  it('refreshes privately, sends MIME over HTTPS, and reuses the access token', async () => {
    request
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(sentResponse())
      .mockResolvedValueOnce(sentResponse());
    const provider = new GmailMailProvider(config());
    expect((await provider.send(message)).messageId).toBe('gmail-message-test');
    await provider.send(message);
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[0][0]).toBe(
      'https://oauth2.googleapis.com/token',
    );
    expect(
      (request.mock.calls[0][1]?.body as URLSearchParams).get('refresh_token'),
    ).toBe('refresh-test');
    expect(request.mock.calls[1][0]).toBe(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    );
    const options = request.mock.calls[1][1]!;
    expect(new Headers(options.headers).get('Authorization')).toBe(
      'Bearer access-test',
    );
    expect(options.body).not.toContain('refresh-test');
    const mime = Buffer.from(
      (JSON.parse(options.body as string) as { raw: string }).raw,
      'base64url',
    ).toString();
    expect(mime).toContain('To: recipient@example.com\r\n');
    expect(mime).toContain('multipart/alternative');
    expect(mime).toContain(Buffer.from(message.text).toString('base64'));
    expect(mime).toContain(Buffer.from(message.html).toString('base64'));
  });
  it('shares one refresh across concurrent sends', async () => {
    request
      .mockResolvedValueOnce(tokenResponse())
      .mockImplementation(() => Promise.resolve(sentResponse()));
    const provider = new GmailMailProvider(config());
    await Promise.all([provider.send(message), provider.send(message)]);
    expect(
      request.mock.calls.filter(
        ([url]) => url === 'https://oauth2.googleapis.com/token',
      ),
    ).toHaveLength(1);
  });
  it.each([400, 401, 403, 429, 500])(
    'does not retry or leak failed sends (%s)',
    async (status) => {
      request
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(
          new Response('private provider detail', { status }),
        );
      await expect(
        new GmailMailProvider(config()).send(message),
      ).rejects.toThrow('temporarily unavailable');
      expect(request).toHaveBeenCalledTimes(2);
    },
  );
  it('rejects revoked credentials without sending', async () => {
    request.mockResolvedValueOnce(
      new Response('invalid_grant private secret', { status: 400 }),
    );
    await expect(new GmailMailProvider(config()).send(message)).rejects.toThrow(
      'temporarily unavailable',
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('rejects missing message IDs and network errors', async () => {
    request
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response('{}'))
      .mockRejectedValueOnce(new Error('private token'));
    const provider = new GmailMailProvider(config());
    await expect(provider.send(message)).rejects.toThrow(
      'temporarily unavailable',
    );
    await expect(provider.send(message)).rejects.toThrow(
      'temporarily unavailable',
    );
  });
  it('rejects recipient header injection before contacting Google', async () => {
    await expect(
      new GmailMailProvider(config()).send({
        ...message,
        to: 'a@example.com\r\nBcc: victim@example.com',
      }),
    ).rejects.toThrow('temporarily unavailable');
    expect(request).not.toHaveBeenCalled();
  });
  it('refreshes on the next request after a 401 without replaying the failed send', async () => {
    request
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(sentResponse());
    const provider = new GmailMailProvider(config());
    await expect(provider.send(message)).rejects.toThrow(
      'temporarily unavailable',
    );
    expect((await provider.send(message)).messageId).toBe('gmail-message-test');
    expect(request).toHaveBeenCalledTimes(4);
  });
  it('refreshes an expiring token and supports plain text messages', async () => {
    request
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'short-test', expires_in: 30 }),
        ),
      )
      .mockResolvedValueOnce(sentResponse())
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(sentResponse());
    const provider = new GmailMailProvider(config());
    await provider.send({ ...message, html: undefined });
    await provider.send(message);
    expect(request).toHaveBeenCalledTimes(4);
    const body = JSON.parse(request.mock.calls[1][1]?.body as string) as {
      raw: string;
    };
    const mime = Buffer.from(body.raw, 'base64url').toString();
    expect(mime).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(mime).not.toContain('multipart/alternative');
  });
});
