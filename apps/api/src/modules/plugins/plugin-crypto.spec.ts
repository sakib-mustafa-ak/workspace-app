import { randomBytes } from 'node:crypto';
import { decryptTokens, encryptTokens } from './plugin-crypto';

describe('plugin credentials', () => {
  const key = randomBytes(32).toString('base64');
  const context = 'workspace:github:admin';
  it('encrypts tokens with randomized authenticated ciphertext', () => {
    const tokens = {
      accessToken: 'private-token',
      refreshToken: 'private-refresh',
    };
    const encrypted = encryptTokens(tokens, key, context);
    expect(encrypted).not.toContain('private');
    expect(decryptTokens(encrypted, key, context)).toEqual(tokens);
    expect(encryptTokens(tokens, key, context)).not.toEqual(encrypted);
  });
  it('rejects different workspaces, keys, malformed and tampered ciphertext', () => {
    const encrypted = encryptTokens({ accessToken: 'secret' }, key, context);
    expect(() => decryptTokens(encrypted, key, 'other:github:admin')).toThrow();
    expect(() =>
      decryptTokens(encrypted, randomBytes(32).toString('base64'), context),
    ).toThrow();
    expect(() => decryptTokens('invalid', key, context)).toThrow();
    const parts = encrypted.split('.');
    parts[1] = Buffer.alloc(16).toString('base64');
    expect(() => decryptTokens(parts.join('.'), key, context)).toThrow();
    expect(() => encryptTokens({}, 'short', context)).toThrow();
  });
});
