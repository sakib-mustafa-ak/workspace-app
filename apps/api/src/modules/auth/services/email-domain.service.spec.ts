import { Resolver } from 'node:dns/promises';
import {
  EmailDomainService,
  MailDomainDns,
  normalizeEmailAddress,
} from './email-domain.service';

const dnsError = (code: string) =>
  Object.assign(new Error('DNS response'), { code });

describe('signup email domain checks', () => {
  const dns = { acceptsMail: jest.fn() };
  const service = new EmailDomainService(dns);
  beforeEach(() => {
    jest.clearAllMocks();
    dns.acceptsMail.mockResolvedValue(true);
  });

  it('normalizes whitespace and case before checking the domain', async () => {
    await expect(service.validateAddress('  Person@GMAIL.COM ')).resolves.toBe(
      'person@gmail.com',
    );
    expect(dns.acceptsMail).toHaveBeenCalledWith('gmail.com');
  });
  it('supports internationalized domains without a provider allowlist', async () => {
    await expect(service.validateAddress('person@bücher.de')).resolves.toBe(
      'person@xn--bcher-kva.de',
    );
  });
  it('uses the same normalization for login and recovery without new DNS checks', () => {
    expect(normalizeEmailAddress(' Person@BÜCHER.de ')).toBe(
      'person@xn--bcher-kva.de',
    );
    expect(normalizeEmailAddress('not-an-email')).toBe('not-an-email');
    expect(dns.acceptsMail).not.toHaveBeenCalled();
  });
  it.each([
    'not-email',
    'a@localhost',
    'a@127.0.0.1',
    'a@.com',
    'a@@example.com',
    'a@bad domain.com',
    `${'a'.repeat(255)}@example.com`,
  ])('rejects malformed address %s before DNS', async (email) => {
    await expect(service.validateAddress(email)).rejects.toMatchObject({
      response: { code: 'AUTH.INVALID_EMAIL_DOMAIN' },
      status: 400,
    });
    expect(dns.acceptsMail).not.toHaveBeenCalled();
  });
  it('rejects the reported made-up domain', async () => {
    dns.acceptsMail.mockResolvedValue(false);
    await expect(
      service.validateAddress('asdas@kdasf.csid'),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('treats a DNS outage as retryable and never silently accepts the address', async () => {
    dns.acceptsMail.mockRejectedValue(dnsError('ETIMEOUT'));
    await expect(
      service.validateAddress('person@example.com'),
    ).rejects.toMatchObject({
      response: { code: 'AUTH.EMAIL_CHECK_UNAVAILABLE' },
      status: 503,
    });
  });
});

describe('mail domain DNS resolution', () => {
  const dns = new MailDomainDns();
  beforeEach(() => {
    jest
      .spyOn(Resolver.prototype, 'resolveMx')
      .mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
    jest
      .spyOn(Resolver.prototype, 'resolve4')
      .mockRejectedValue(dnsError('ENODATA'));
    jest
      .spyOn(Resolver.prototype, 'resolve6')
      .mockRejectedValue(dnsError('ENODATA'));
  });
  afterEach(() => jest.restoreAllMocks());
  it('accepts a configured MX record', async () => {
    await expect(dns.acceptsMail('example.com')).resolves.toBe(true);
  });
  it.each(['.', ''])(
    'rejects null MX (%j), including Node normalized empty exchanges',
    async (exchange) => {
      jest
        .spyOn(Resolver.prototype, 'resolveMx')
        .mockResolvedValue([{ priority: 0, exchange }]);
      await expect(dns.acceptsMail('example.com')).resolves.toBe(false);
      expect(Resolver.prototype.resolve4).not.toHaveBeenCalled();
    },
  );
  it('rejects nonexistent domains without probing SMTP', async () => {
    jest
      .spyOn(Resolver.prototype, 'resolveMx')
      .mockRejectedValue(dnsError('ENOTFOUND'));
    await expect(dns.acceptsMail('example.invalid')).resolves.toBe(false);
  });
  it('permits implicit MX via an IPv4 address when MX is absent', async () => {
    jest
      .spyOn(Resolver.prototype, 'resolveMx')
      .mockRejectedValue(dnsError('ENODATA'));
    jest.spyOn(Resolver.prototype, 'resolve4').mockResolvedValue(['192.0.2.1']);
    await expect(dns.acceptsMail('example.com')).resolves.toBe(true);
  });
  it('permits implicit MX via IPv6', async () => {
    jest.spyOn(Resolver.prototype, 'resolveMx').mockResolvedValue([]);
    jest
      .spyOn(Resolver.prototype, 'resolve6')
      .mockResolvedValue(['2001:db8::1']);
    await expect(dns.acceptsMail('example.com')).resolves.toBe(true);
  });
  it('rejects a domain with neither MX nor addresses', async () => {
    jest.spyOn(Resolver.prototype, 'resolveMx').mockResolvedValue([]);
    await expect(dns.acceptsMail('example.com')).resolves.toBe(false);
  });
  it.each(['ETIMEOUT', 'ESERVFAIL', 'ECANCELLED'])(
    'propagates retryable MX errors: %s',
    async (code) => {
      jest
        .spyOn(Resolver.prototype, 'resolveMx')
        .mockRejectedValue(dnsError(code));
      await expect(dns.acceptsMail('example.com')).rejects.toMatchObject({
        code,
      });
    },
  );
  it('does not turn an address-lookup outage into a nonexistent-domain result', async () => {
    jest.spyOn(Resolver.prototype, 'resolveMx').mockResolvedValue([]);
    jest
      .spyOn(Resolver.prototype, 'resolve6')
      .mockRejectedValue(dnsError('ETIMEOUT'));
    await expect(dns.acceptsMail('example.com')).rejects.toMatchObject({
      code: 'ETIMEOUT',
    });
  });
});
