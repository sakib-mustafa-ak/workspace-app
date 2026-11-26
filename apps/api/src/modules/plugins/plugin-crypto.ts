import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function encryptTokens(
  value: unknown,
  base64Key: string,
  context: string,
): string {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) throw new Error('Invalid plugin encryption key.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), data]
    .map((part) => part.toString('base64'))
    .join('.');
}

export function decryptTokens<T>(
  value: string,
  base64Key: string,
  context: string,
): T {
  const [iv, tag, data] = value
    .split('.')
    .map((part) => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(base64Key, 'base64'),
    iv,
  );
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'),
  ) as T;
}
