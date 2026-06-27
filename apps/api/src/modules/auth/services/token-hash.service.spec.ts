import { TokenHashService } from './token-hash.service';

describe('TokenHashService', () => {
  let service: TokenHashService;

  beforeEach(() => {
    service = new TokenHashService();
  });

  it('produces a stable hash for the same plain token', () => {
    const plain = 'opaque-refresh-value';
    expect(service.hash(plain)).toBe(service.hash(plain));
  });

  it('returns different hashes for different inputs', () => {
    expect(service.hash('a')).not.toBe(service.hash('b'));
  });

  it('verifies a freshly generated token — and rejects a tampered one', () => {
    const t = service.generateRefreshToken();
    expect(service.equals(t.hash, t.plain)).toBe(true);
    expect(service.equals(t.hash, t.plain + 'x')).toBe(false);
  });

  it('returns false if the stored hash is malformed', () => {
    expect(service.equals('not-hex', 'whatever')).toBe(false);
  });

  it('returns false if either side is missing', () => {
    expect(service.equals('', '')).toBe(false);
    expect(service.equals('aa', '')).toBe(false);
  });
});
