import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

// Disposable PostgreSQL-compatible database. Never connects to DATABASE_URL.
delete process.env.DATABASE_URL;
const databaseRequire = createRequire(new URL('../../../packages/database/package.json', import.meta.url));
const { PGlite } = databaseRequire('@electric-sql/pglite');
const { drizzle } = databaseRequire('drizzle-orm/pglite');
const { TrelloImportService } = await import('../dist/modules/boards/trello/trello-import.service.js');
const { UsageService } = await import('../dist/modules/billing/services/usage.service.js');
const { UsageRepository } = await import('../dist/modules/billing/data/usage.repository.js');
const { BillingRepository } = await import('../dist/modules/billing/data/billing.repository.js');
const { BillingPolicy } = await import('../dist/modules/billing/policies/billing.policy.js');
const database = new PGlite();
const db = drizzle(database);
const migrations = new URL('../../../packages/database/src/migrations/', import.meta.url);
const journal = JSON.parse(await readFile(new URL('meta/_journal.json', migrations), 'utf8'));
const workspaceId = randomUUID();
const userId = randomUUID();
const events = [];
const usage = new UsageService(new UsageRepository(db), new BillingRepository(db), new BillingPolicy());
const importer = new TrelloImportService(db, usage, { publishBoardCreated: (event) => events.push(event) });
const fixture = {
  id: 'source', name: 'Import integration test', desc: 'Original description',
  lists: [{ id: 'l1', name: 'To do', pos: 200 }, { id: 'l2', name: 'Done', pos: 100 }],
  cards: [{ id: 'c1', idList: 'l1', name: 'Write tests', due: '2026-12-01T12:00:00.000Z', dueComplete: true }],
  checklists: [{ id: 'cl1', idCard: 'c1', name: 'QA', checkItems: [{ id: 'i1', name: 'Verify rollback', state: 'complete' }] }],
};
try {
  for (const entry of journal.entries) await database.exec(await readFile(new URL(`${entry.tag}.sql`, migrations), 'utf8'));
  await database.query('INSERT INTO users (id, display_name, email, password_hash) VALUES ($1, $2, $3, $4)', [userId, 'Import test', 'trello@example.test', 'test-only']);
  await database.query('INSERT INTO workspaces (id, name, slug, owner_id) VALUES ($1, $2, $3, $4)', [workspaceId, 'Import workspace', 'trello-test', userId]);
  await database.query("INSERT INTO workspace_members (id, workspace_id, user_id, role, status, joined_at) VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', now())", [randomUUID(), workspaceId, userId]);
  await assert.rejects(importer.preview(workspaceId, randomUUID(), fixture), /Insufficient workspace role/);
  const preview = await importer.preview(workspaceId, userId, fixture);
  assert.equal(preview.cardCount, 1);
  assert.equal((await database.query('SELECT * FROM boards')).rows.length, 0);
  const result = await importer.importBoard(workspaceId, userId, fixture);
  assert.equal(result.board.position, 0);
  const columns = await database.query('SELECT name, position FROM board_columns ORDER BY position');
  assert.deepEqual(columns.rows.map((row) => row.name), ['Done', 'To do']);
  const cards = await database.query('SELECT title, status, due_date, completed_at FROM tasks');
  assert.equal(cards.rows[0].status, 'DONE');
  assert.equal(new Date(cards.rows[0].due_date).toISOString(), '2026-12-01T12:00:00.000Z');
  assert.equal(cards.rows[0].completed_at, null);
  const checklist = await database.query('SELECT text, completed FROM checklist_items');
  assert.deepEqual(checklist.rows, [{ text: 'QA: Verify rollback', completed: true }]);
  assert.equal(events.length, 1);
  const before = await database.query('SELECT (SELECT count(*)::int FROM boards) AS boards, (SELECT count(*)::int FROM board_columns) AS columns, (SELECT count(*)::int FROM tasks) AS tasks');
  // Fail at the final write, after board, columns and tasks have been inserted.
  await database.exec("ALTER TABLE checklist_items ADD CONSTRAINT import_test_failure CHECK (text <> 'QA: Verify rollback') NOT VALID");
  await assert.rejects(importer.importBoard(workspaceId, userId, fixture));
  const after = await database.query('SELECT (SELECT count(*)::int FROM boards) AS boards, (SELECT count(*)::int FROM board_columns) AS columns, (SELECT count(*)::int FROM tasks) AS tasks');
  assert.deepEqual(after.rows, before.rows, 'Failed imports must roll back every inserted row');
  assert.equal(events.length, 1, 'Rolled-back imports must not publish board-created events');
  await database.exec('ALTER TABLE checklist_items DROP CONSTRAINT import_test_failure');
  await importer.importBoard(workspaceId, userId, fixture);
  await importer.importBoard(workspaceId, userId, fixture);
  await assert.rejects(importer.importBoard(workspaceId, userId, fixture), (error) => error.code === 'BILLING.LIMIT_REACHED');
  assert.equal((await database.query('SELECT * FROM boards')).rows.length, 3);
  console.log('Trello integration passed: preview, mapping, membership, plan limits and atomic rollback.');
} finally {
  await database.close();
}
