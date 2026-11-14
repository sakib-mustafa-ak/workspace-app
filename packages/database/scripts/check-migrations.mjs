import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// A disposable database: never reads DATABASE_URL or connects to a server.
const database = new PGlite();
const migrations = new URL('../src/migrations/', import.meta.url);
const journal = JSON.parse(await readFile(new URL('meta/_journal.json', migrations), 'utf8'));
try {
  for (const entry of journal.entries) {
    await database.exec(await readFile(new URL(`${entry.tag}.sql`, migrations), 'utf8'));
    if (entry.idx === 5) {
      await database.exec(`
        INSERT INTO users (id, display_name, email, password_hash)
        VALUES ('00000000-0000-4000-8000-000000000001', 'Migration test', 'migration@example.test', 'test-only');
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
        VALUES ('00000000-0000-4000-8000-000000000001', 'https://example.test/push', 'test-key', 'test-auth');
      `);
    }
    console.log(`Applied ${entry.tag}`);
  }
  const retained = await database.query("SELECT count(*)::int AS count FROM push_subscriptions WHERE endpoint = 'https://example.test/push'");
  assert.equal(retained.rows[0].count, 1, 'Existing push subscription data must survive upgrades');
  for (const name of ['push_subscriptions', 'admin_audit_log', 'notification_preferences', 'workspace_subscriptions', 'stripe_webhook_events']) {
    const { rows } = await database.query('SELECT to_regclass($1) AS name', [name]);
    assert.ok(rows[0].name, `${name} must exist after migrations`);
  }
  console.log('All migrations passed; push subscriptions preserved.');
} finally {
  await database.close();
}
