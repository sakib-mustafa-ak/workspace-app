import { ConfigService } from '@nestjs/config';
import { emailVerificationTokens, type Db } from '@repo/database';
import { RecordingMailProvider } from '../mail/mail.provider';
import { AuthEventBus } from '../events/auth.events';
import { EmailVerificationTokenRepository } from '../repositories/email-verification-token.repository';
import { EmailVerificationService } from './email-verification.service';
import { TokenHashService } from './token-hash.service';

function setup() {
  const hash = new TokenHashService();
  const row = {
    id: 'token-id',
    userId: 'user-id',
    email: 'test@example.test',
    selector: 'selector',
    verifierHash: hash.hash('secret'),
    consumedAt: null as Date | null,
    expiresAt: new Date(Date.now() + 60000),
  };
  const found = jest
    .fn()
    .mockResolvedValue([
      { id: row.userId, email: row.email, verifiedAt: null },
    ]);
  const consumed = jest.fn().mockResolvedValue([{ id: row.id }]);
  const updated = jest.fn().mockResolvedValue([{ id: row.userId }]);
  const tx = {
    update: jest.fn().mockImplementation((table: unknown) => ({
      set: () => ({
        where: () => ({
          returning: table === emailVerificationTokens ? consumed : updated,
        }),
      }),
    })),
  };
  const events = {
    publishEmailVerificationRequested: jest.fn(),
    publishEmailVerified: jest.fn(),
  };
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: found }) }) }),
    transaction: jest
      .fn()
      .mockImplementation(
        async (run: (executor: typeof tx) => Promise<unknown>) => {
          const value = await run(tx);
          expect(events.publishEmailVerified).not.toHaveBeenCalled();
          return value;
        },
      ),
  };
  const repo = {
    mintForUser: jest.fn().mockResolvedValue(row),
    findBySelector: jest.fn().mockResolvedValue(row),
  };
  const mail = new RecordingMailProvider();
  const service = new EmailVerificationService(
    db as unknown as Db,
    mail,
    events as unknown as AuthEventBus,
    hash,
    repo as unknown as EmailVerificationTokenRepository,
    new ConfigService({ app: { publicBaseUrl: 'https://app.example.com' } }),
  );
  return { service, repo, mail, row, events, found, consumed, updated, db };
}

describe('email verification workflow', () => {
  it('sends a 24-hour link and stores only the verifier hash', async () => {
    const { service, mail, repo } = setup();
    await service.requestVerification({
      userId: 'user-id',
      email: 'test@example.test',
    });
    const sent = mail.snapshot()[0];
    const url = new URL(sent.text.match(/https:\/\/\S+/)?.[0] ?? '');
    const token = url.searchParams.get('token') ?? '';
    expect(token.split('.')).toHaveLength(2);
    expect(repo.mintForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        verifierHash: new TokenHashService().hash(token.split('.')[1]),
      }),
    );
    expect(sent.text).toContain('1440 minutes');
  });
  it.each([
    { rows: [] },
    {
      rows: [
        { id: 'user', email: 'test@example.test', verifiedAt: new Date() },
      ],
    },
  ])('does not send to unknown or verified accounts', async ({ rows }) => {
    const { service, found, mail } = setup();
    found.mockResolvedValue(rows);
    await service.requestVerificationForEmail('TEST@example.test');
    expect(mail.snapshot()).toHaveLength(0);
  });
  it('keeps resend responses generic when delivery fails', async () => {
    const { service, mail } = setup();
    jest.spyOn(mail, 'send').mockRejectedValue(new Error('provider down'));
    await expect(
      service.requestVerificationForEmail('test@example.test'),
    ).resolves.toBeUndefined();
  });
  it('consumes and verifies atomically, then publishes after commit', async () => {
    const { service, events, consumed, updated } = setup();
    await expect(service.verify({ token: 'selector.secret' })).resolves.toEqual(
      { userId: 'user-id', email: 'test@example.test' },
    );
    expect(consumed).toHaveBeenCalled();
    expect(updated).toHaveBeenCalled();
    expect(events.publishEmailVerified).toHaveBeenCalledTimes(1);
  });
  it.each(['malformed', 'selector.wrong-secret'])(
    'rejects invalid token %s',
    async (token) => {
      const { service, events } = setup();
      await expect(service.verify({ token })).rejects.toMatchObject({
        response: { code: 'AUTH.INVALID_VERIFICATION_TOKEN' },
      });
      expect(events.publishEmailVerified).not.toHaveBeenCalled();
    },
  );
  it.each(['expired', 'consumed', 'missing'])(
    'rejects a %s token',
    async (state) => {
      const { service, row, repo, db } = setup();
      if (state === 'expired') row.expiresAt = new Date(0);
      if (state === 'consumed') row.consumedAt = new Date();
      if (state === 'missing') repo.findBySelector.mockResolvedValue(undefined);
      await expect(
        service.verify({ token: 'selector.secret' }),
      ).rejects.toThrow();
      expect(db.transaction).not.toHaveBeenCalled();
    },
  );
  it('does not verify or emit on a lost consume race', async () => {
    const { service, consumed, updated, events } = setup();
    consumed.mockResolvedValue([]);
    await expect(service.verify({ token: 'selector.secret' })).rejects.toThrow(
      'already been used',
    );
    expect(updated).not.toHaveBeenCalled();
    expect(events.publishEmailVerified).not.toHaveBeenCalled();
  });
  it('rejects deleted or changed-email accounts without publishing', async () => {
    const { service, updated, events } = setup();
    updated.mockResolvedValue([]);
    await expect(service.verify({ token: 'selector.secret' })).rejects.toThrow(
      'no longer matches',
    );
    expect(events.publishEmailVerified).not.toHaveBeenCalled();
  });
});
