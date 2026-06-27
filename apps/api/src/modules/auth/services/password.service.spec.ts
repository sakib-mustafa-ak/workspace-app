import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('hashes a password into a verifiable argon2id string', async () => {
    const hash = await service.hash('correct-horse-battery-staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(service.verify(hash, 'correct-horse-battery-staple')).resolves.toBe(true);
  });

  it('rejects a wrong plaintext', async () => {
    const hash = await service.hash('correct-horse-battery-staple');
    await expect(service.verify(hash, 'wrong')).resolves.toBe(false);
  });

  it('returns false for empty inputs', async () => {
    await expect(service.verify('', 'x')).resolves.toBe(false);
    await expect(service.verify('hash', '')).resolves.toBe(false);
  });

  it('returns false when the stored hash is malformed', async () => {
    await expect(service.verify('not-an-argon-hash', 'whatever')).resolves.toBe(false);
  });
});
