import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

// Disposable PostgreSQL-compatible database, no external mail or database.
delete process.env.DATABASE_URL;
const databaseRequire = createRequire(new URL('../../../packages/database/package.json', import.meta.url));
const { PGlite } = databaseRequire('@electric-sql/pglite');
const { drizzle } = databaseRequire('drizzle-orm/pglite');
const { ConfigService } = await import('@nestjs/config');
const { EmailVerificationService } = await import('../dist/modules/auth/services/email-verification.service.js');
const { EmailVerificationTokenRepository } = await import('../dist/modules/auth/repositories/email-verification-token.repository.js');
const { RecordingMailProvider } = await import('../dist/modules/auth/mail/mail.provider.js');
const { TokenHashService } = await import('../dist/modules/auth/services/token-hash.service.js');
const database = new PGlite();
const db = drizzle(database);
const migrations = new URL('../../../packages/database/src/migrations/', import.meta.url);
const journal = JSON.parse(await readFile(new URL('meta/_journal.json', migrations), 'utf8'));
const userId = randomUUID();
const email = 'verification@example.test';
const mail = new RecordingMailProvider();
const events = [];
const service = new EmailVerificationService(db, mail, { publishEmailVerificationRequested: () => {}, publishEmailVerified: (id) => events.push(id) }, new TokenHashService(), new EmailVerificationTokenRepository(db), new ConfigService({ app: { publicBaseUrl: 'https://app.example.test' } }));
function latestToken() {
  const message = mail.snapshot().at(-1);
  return new URL(message.text.match(/https:\/\/\S+/)[0]).searchParams.get('token');
}
try {
  for (const entry of journal.entries) await database.exec(await readFile(new URL(`${entry.tag}.sql`, migrations), 'utf8'));
  await database.query('INSERT INTO users (id, display_name, email, password_hash) VALUES ($1, $2, $3, $4)', [userId, 'Verification test', email, 'test-only']);
  await service.requestVerification({ userId, email });
  const first = latestToken();
  await service.requestVerificationForEmail(email.toUpperCase());
  const current = latestToken();
  assert.notEqual(first, current);
  await assert.rejects(service.verify({ token: first }));
  assert.equal((await database.query('SELECT email_verified_at FROM users WHERE id = $1', [userId])).rows[0].email_verified_at, null);
  await service.verify({ token: current });
  assert.ok((await database.query('SELECT email_verified_at FROM users WHERE id = $1', [userId])).rows[0].email_verified_at);
  await assert.rejects(service.verify({ token: current }));
  assert.deepEqual(events, [userId]);
  const sentCount = mail.snapshot().length;
  await service.requestVerificationForEmail(email);
  await service.requestVerificationForEmail('unknown@example.test');
  assert.equal(mail.snapshot().length, sentCount);

  // Changing the target email must roll back token consumption, not verify it.
  await service.requestVerification({ userId, email });
  const staleEmailToken = latestToken();
  await database.query('UPDATE users SET email = $1, email_verified_at = NULL WHERE id = $2', ['changed@example.test', userId]);
  await assert.rejects(service.verify({ token: staleEmailToken }));
  const persisted = await database.query('SELECT consumed_at FROM email_verification_tokens WHERE selector = $1', [staleEmailToken.split('.')[0]]);
  assert.equal(persisted.rows[0].consumed_at, null, 'Changed-email failures roll back token consumption');
  assert.equal(events.length, 1);
  console.log('Email verification integration passed: hashed tokens, resend invalidation, one-time use, account update and rollback. No real emails sent.');
} finally {
  await database.close();
}
