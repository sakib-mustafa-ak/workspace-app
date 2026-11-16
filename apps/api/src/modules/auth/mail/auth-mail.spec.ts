const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));

// The repository's lightweight TypeScript transformer does not hoist mocks.
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { ResendMailProvider } from './resend-mail.provider';
import { renderVerificationMail } from './verification.template';
import { renderPasswordResetMail } from './password-reset.template';

describe('authentication email', () => {
  beforeEach(() => jest.clearAllMocks());
  it.each([
    [
      'verification',
      renderVerificationMail({
        appBaseUrl: 'https://app.example.com',
        verifyPath: '/auth/verify-email',
        selector: 'selector',
        verifier: 'secret',
        expiresInMinutes: 1440,
      }),
    ],
    [
      'password reset',
      renderPasswordResetMail({
        appBaseUrl: 'https://app.example.com',
        resetPath: '/auth/reset-password',
        selector: 'selector',
        verifier: 'secret',
        expiresInMinutes: 30,
      }),
    ],
  ])('builds a %s link the web application understands', (_label, rendered) => {
    const match = rendered.text.match(/https:\/\/\S+/);
    expect(match).not.toBeNull();
    const url = new URL(match?.[0] ?? '');
    expect(url.searchParams.get('token')).toBe('selector.secret');
    expect(url.searchParams.has('verifier')).toBe(false);
    expect(rendered.html).toContain('token=selector.secret');
  });
  it('uses the server-only key and configured sender', async () => {
    mockSend.mockResolvedValue({ data: { id: 'mail-test' }, error: null });
    const provider = new ResendMailProvider(
      new ConfigService({
        mail: {
          apiKey: 're_test_only',
          from: 'Workspace <accounts@example.com>',
        },
      }),
    );
    const result = await provider.send({
      to: 'test@example.test',
      subject: 'Verify',
      text: 'Test',
    });
    expect(Resend).toHaveBeenCalledWith('re_test_only');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Workspace <accounts@example.com>',
        to: 'test@example.test',
      }),
    );
    expect(result.messageId).toBe('mail-test');
  });
  it.each([
    {
      data: null,
      error: { name: 'validation_error', message: 'private provider details' },
    },
    { data: null, error: null },
  ])('never reports an unaccepted message as sent', async (response) => {
    mockSend.mockResolvedValue(response);
    const provider = new ResendMailProvider(
      new ConfigService({ mail: { apiKey: 're_test_only' } }),
    );
    await expect(
      provider.send({
        to: 'test@example.test',
        subject: 'Verify',
        text: 'Test',
      }),
    ).rejects.toThrow('temporarily unavailable');
  });
});
