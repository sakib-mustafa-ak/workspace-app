import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ModuleRef, Reflector } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';

// All persistence and provider requests are isolated; no production DB/network.
delete process.env.DATABASE_URL;
const requireDatabase = createRequire(new URL('../../../packages/database/package.json', import.meta.url));
const { PGlite } = requireDatabase('@electric-sql/pglite');
const { drizzle } = requireDatabase('drizzle-orm/pglite');
const schema = await import('../../../packages/database/dist/index.js');
const { PluginsModule } = await import('../dist/modules/plugins/plugins.module.js');
const { PluginsService } = await import('../dist/modules/plugins/plugins.service.js');
const { DatabaseModule } = await import('../dist/infrastructure/database/database.module.js');
const { BoardAccessModule } = await import('../dist/common/board-access/board-access.module.js');
const { BoardAccessService } = await import('../dist/common/board-access/board-access.service.js');
const { BoardAccessGuard } = await import('../dist/common/board-access/board-access.guard.js');
const { WorkspaceMembershipGuard } = await import('../dist/common/guards/workspace-membership.guard.js');
const { decryptTokens } = await import('../dist/modules/plugins/plugin-crypto.js');
const database = new PGlite();
const db = drizzle(database);
const realFetch = globalThis.fetch;
const calls = [];
let failData = false, failExchange = false;
const encryptionKey = randomBytes(32).toString('base64');
const config = { app: { publicBaseUrl: 'https://workspace.example.test' }, plugins: {
  encryptionKey,
  github: { clientId: 'test-github-id', clientSecret: 'test-github-secret' },
  slack: { clientId: 'test-slack-id', clientSecret: 'test-slack-secret' },
  google: { clientId: 'test-google-id', clientSecret: 'test-google-secret' },
} };
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), ...init });
  const value = String(url);
  let payload;
  if (value.includes('access_token') || value.includes('oauth2.googleapis.com/token') || value.includes('oauth.v2.access')) {
    if (failExchange) return Response.json({ error: 'provider-secret-should-not-leak' }, { status: 400 });
    const refreshing = String(init.body).includes('refresh_token');
    payload = { ok: true, access_token: refreshing ? 'rotated-private-token' : 'private-provider-token', refresh_token: refreshing ? 'rotated-private-refresh' : 'private-provider-refresh', expires_in: 3600 };
  } else if (failData) return Response.json({ error: 'private-provider-message' }, { status: 429 });
  else if (value.includes('api.github.com/user/repos')) payload = [{ id: 1, full_name: 'demo/public', html_url: 'https://github.com/demo/public', private: false }, { id: 2, full_name: 'demo/secret', private: true }];
  else if (value.includes('api.github.com/repos/') && !value.includes('/issues')) payload = { private: value.includes('secret') };
  else if (value.includes('/issues')) payload = [{ id: 4, title: 'Fix bug', html_url: 'https://github.com/demo/public/issues/4' }, { id: 5, title: 'PR', pull_request: {} }];
  else if (value.includes('conversations.list')) payload = { ok: true, channels: [{ id: 'C123456789', name: 'general', is_member: true }] };
  else if (value.includes('chat.postMessage')) payload = { ok: true };
  else if (value.includes('calendar/v3/')) payload = { items: [{ id: 'event-1', summary: 'Review', start: { dateTime: '2027-01-01T10:00:00Z' } }] };
  else throw new Error('Unexpected external URL: ' + value);
  return Response.json(payload);
};

let app;
try {
  const migrations = new URL('../../../packages/database/src/migrations/', import.meta.url);
  const journal = JSON.parse(await readFile(new URL('meta/_journal.json', migrations), 'utf8'));
  for (const entry of journal.entries) await database.exec(await readFile(new URL(`${entry.tag}.sql`, migrations), 'utf8'));
  const [owner, admin, editor, viewer, outsider] = Array.from({ length: 5 }, () => randomUUID());
  for (const id of [owner, admin, editor, viewer, outsider]) await db.insert(schema.users).values({ id, email: `${id}@example.test`, displayName: 'Test', passwordHash: 'test-only', emailVerifiedAt: new Date() });
  const [workspace, foreign] = await db.insert(schema.workspaces).values([{ name: 'Plugins', slug: 'plugins', ownerId: owner }, { name: 'Foreign', slug: 'foreign', ownerId: outsider }]).returning();
  for (const [userId, role] of [[owner, 'OWNER'], [admin, 'ADMIN'], [editor, 'EDITOR'], [viewer, 'VIEWER']]) await db.insert(schema.workspaceMembers).values({ workspaceId: workspace.id, userId, role, status: 'ACTIVE', joinedAt: new Date() });
  const [board] = await db.insert(schema.boards).values({ workspaceId: workspace.id, name: 'Board', position: 0 }).returning();
  const [column] = await db.insert(schema.boardColumns).values({ boardId: board.id, name: 'Tasks', position: 0 }).returning();
  const [task, second] = await db.insert(schema.tasks).values(['One', 'Two'].map((title) => ({ workspaceId: workspace.id, boardId: board.id, columnId: column.id, title, createdById: owner }))).returning();
  const module = await Test.createTestingModule({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => config] }), DatabaseModule, BoardAccessModule, PluginsModule] }).overrideProvider(schema.DATABASE).useValue(db).compile();
  const plugins = module.get(PluginsService);
  const access = module.get(BoardAccessService);
  app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  // Test identities substitute JWT only; actual workspace and board guards run.
  app.use((req, res, next) => { if (!req.headers['x-test-user']) return res.status(401).end(); req.user = { id: req.headers['x-test-user'] }; next(); });
  app.useGlobalGuards(new WorkspaceMembershipGuard(new Reflector(), module.get(ModuleRef), db), new BoardAccessGuard(db, access));
  await app.init();
  const http = request(app.getHttpServer());
  const base = `/api/v1/workspaces/${workspace.id}/plugins`;
  await http.get(base).expect(401);
  await http.get(base).set('x-test-user', outsider).expect(403);
  const catalog = await http.get(base).set('x-test-user', viewer).expect(200);
  assert.equal(catalog.body.canManage, false);
  assert.equal(catalog.body.plugins.length, 6);
  assert.equal(catalog.body.plugins.find((plugin) => plugin.key === 'custom-extensions').comingSoon, true);
  await http.put(`${base}/custom-extensions`).set('x-test-user', owner).send({ enabled: true }).expect(400);
  await http.put(`${base}/task-voting`).set('x-test-user', viewer).send({ enabled: true }).expect(403);
  await http.put(`${base}/task-voting`).set('x-test-user', owner).send({ enabled: true, userId: outsider }).expect(400);
  await http.put(`${base}/task-voting`).set('x-test-user', owner).send({ enabled: true }).expect(200);
  await http.put(`${base}/time-tracking`).set('x-test-user', owner).send({ enabled: true }).expect(200);
  await http.put(`${base}/tasks/${task.id}/vote`).set('x-test-user', viewer).send({ voted: true }).expect(200);
  await plugins.vote(workspace.id, viewer, task.id, true);
  assert.equal((await plugins.taskStatus(workspace.id, viewer, task.id)).votes, 1);
  assert.equal((await plugins.taskStatus(workspace.id, editor, task.id)).voted, false);
  await plugins.vote(workspace.id, viewer, task.id, false);
  assert.equal((await plugins.taskStatus(workspace.id, viewer, task.id)).votes, 0);
  await http.post(`${base}/tasks/${task.id}/timer`).set('x-test-user', viewer).expect(403);
  await plugins.startTimer(workspace.id, editor, task.id);
  await plugins.startTimer(workspace.id, editor, task.id);
  await assert.rejects(plugins.startTimer(workspace.id, editor, second.id), (error) => error.getStatus() === 409);
  assert.equal((await plugins.myTime(workspace.id, editor)).length, 1);
  assert.equal((await plugins.taskStatus(workspace.id, editor, task.id)).runningTaskId, task.id);
  await access.set(board.id, owner, workspace.id, []);
  await http.get(`${base}/tasks/${task.id}`).set('x-test-user', editor).expect(403);
  await assert.rejects(plugins.vote(workspace.id, editor, task.id, true));
  // Revoked board access must not strand a person's running timer.
  await http.post(`${base}/timers/stop`).set('x-test-user', editor).expect(201);
  assert.ok((await plugins.myTime(workspace.id, editor))[0].endedAt);
  await access.set(board.id, owner, workspace.id, null);
  await plugins.startTimer(workspace.id, editor, task.id);
  await plugins.setEnabled(workspace.id, owner, 'time-tracking', false);
  assert.ok((await plugins.myTime(workspace.id, editor)).every((entry) => entry.endedAt));
  await assert.rejects(plugins.startTimer(workspace.id, editor, task.id));
  await assert.rejects(plugins.taskStatus(foreign.id, editor, task.id));
  await assert.rejects(plugins.setEnabled(workspace.id, editor, 'task-voting', false));
  await http.post(`${base}/github/connect`).set('x-test-user', viewer).expect(403);
  for (const provider of ['github', 'slack', 'google-calendar']) {
    const flowResponse = await http.post(`${base}/${provider}/connect`).set('x-test-user', owner).expect(201);
    const flow = flowResponse.body;
    const url = new URL(flow.url);
    assert.equal(url.searchParams.get('state'), flow.state);
    assert.equal(url.searchParams.get('redirect_uri'), `https://workspace.example.test/plugins/callback/${provider}`);
    if (provider !== 'slack') assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    const [pending] = await db.select().from(schema.pluginOauthStates).where(schema.eq(schema.pluginOauthStates.hash, createHash('sha256').update(flow.state).digest('hex')));
    assert.notEqual(pending.hash, flow.state);
    await assert.rejects(plugins.complete(workspace.id, admin, provider, flow.state, 'code'));
    await http.post(`${base}/${provider}/complete`).set('x-test-user', owner).send({ state: flow.state, code: 'code', userId: outsider }).expect(400);
    await http.post(`${base}/${provider}/complete`).set('x-test-user', owner).send({ state: flow.state, code: 'code' }).expect(201);
    assert.equal((await db.select().from(schema.pluginOauthStates).where(schema.eq(schema.pluginOauthStates.hash, pending.hash))).length, 0);
    await assert.rejects(plugins.complete(workspace.id, owner, provider, flow.state, 'code'));
    await assert.rejects(plugins.providerAction(workspace.id, admin, provider));
    await http.get(`${base}/${provider}/data`).set('x-test-user', viewer).expect(403);
    const [saved] = await db.select().from(schema.workspacePlugins).where(schema.and(schema.eq(schema.workspacePlugins.workspaceId, workspace.id), schema.eq(schema.workspacePlugins.key, provider)));
    assert.ok(!saved.credentials.includes('private-provider-token'));
    const response = JSON.stringify(await plugins.list(workspace.id, owner));
    assert.ok(!response.includes(saved.credentials) && !response.includes('private-provider-token'));
    const result = await plugins.providerAction(workspace.id, owner, provider);
    assert.equal(result.length, 1);
    if (provider === 'github') {
      const issues = await plugins.providerAction(workspace.id, owner, provider, { repository: 'demo/public' });
      assert.equal(issues.length, 1);
      await assert.rejects(plugins.providerAction(workspace.id, owner, provider, { repository: 'demo/secret' }));
    }
    if (provider === 'slack') {
      await http.post(`${base}/slack/messages`).set('x-test-user', owner).send({ channel: 'C123456789', text: 'Hello' }).expect(201);
      const posted = calls.findLast((call) => call.url.includes('chat.postMessage'));
      assert.equal(JSON.parse(posted.body).mrkdwn, false);
      await http.post(`${base}/slack/messages`).set('x-test-user', owner).send({ channel: 'invalid', text: 'Hello' }).expect(400);
    }
    // A rotated refresh token must survive a failed downstream API request.
    const tokens = decryptTokens(saved.credentials, encryptionKey, `${workspace.id}:${provider}:${owner}`);
    const { encryptTokens } = await import('../dist/modules/plugins/plugin-crypto.js');
    await db.update(schema.workspacePlugins).set({ credentials: encryptTokens({ ...tokens, expiresAt: 1 }, encryptionKey, `${workspace.id}:${provider}:${owner}`) }).where(schema.eq(schema.workspacePlugins.id, saved.id));
    failData = true;
    await assert.rejects(plugins.providerAction(workspace.id, owner, provider), (error) => !error.message.includes('private-provider-message'));
    failData = false;
    const [rotated] = await db.select().from(schema.workspacePlugins).where(schema.eq(schema.workspacePlugins.id, saved.id));
    assert.equal(decryptTokens(rotated.credentials, encryptionKey, `${workspace.id}:${provider}:${owner}`).refreshToken, 'rotated-private-refresh');
    await plugins.setEnabled(workspace.id, owner, provider, false);
    const [disconnected] = await db.select().from(schema.workspacePlugins).where(schema.eq(schema.workspacePlugins.id, saved.id));
    assert.equal(disconnected.credentials, null);
    await assert.rejects(plugins.providerAction(workspace.id, owner, provider));
  }
  const expired = await plugins.begin(workspace.id, owner, 'github');
  await db.update(schema.pluginOauthStates).set({ expiresAt: new Date(0) });
  await assert.rejects(plugins.complete(workspace.id, owner, 'github', expired.state, 'code'));
  const invalidated = await plugins.begin(workspace.id, owner, 'github');
  await plugins.setEnabled(workspace.id, owner, 'github', false);
  await assert.rejects(plugins.complete(workspace.id, owner, 'github', invalidated.state, 'code'));
  const failed = await plugins.begin(workspace.id, owner, 'github');
  failExchange = true;
  await assert.rejects(plugins.complete(workspace.id, owner, 'github', failed.state, 'code'), (error) => !error.message.includes('provider-secret'));
  failExchange = false;
  await assert.rejects(plugins.complete(workspace.id, owner, 'github', failed.state, 'code'));
  console.log('Plugins integration passed: migrations, real HTTP validation and workspace/board guards, add-ons, timer revocation, OAuth binding/expiry/replay, all three mocked providers, encryption, refresh rotation and disconnect. No real accounts contacted.');
} finally {
  globalThis.fetch = realFetch;
  if (app) await app.close();
  await database.close();
}
