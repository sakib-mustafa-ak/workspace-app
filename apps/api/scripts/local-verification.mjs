import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Controller, Get, Global, Module, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

// No .env loading, no remote databases, no real email, no persistent files.
delete process.env.DATABASE_URL;
const databaseRequire = createRequire(new URL('../../../packages/database/package.json', import.meta.url));
const { PGlite } = databaseRequire('@electric-sql/pglite');
const { drizzle } = databaseRequire('drizzle-orm/pglite');
const { DATABASE } = await import('../../../packages/database/dist/index.js');
const { AuthModule } = await import('../dist/modules/auth/auth.module.js');
const { JwtAuthGuard } = await import('../dist/modules/auth/guards/jwt-auth.guard.js');
const { EMAIL_DNS } = await import('../dist/modules/auth/services/email-domain.service.js');
const { BusinessExceptionFilter } = await import('../dist/common/filters/business-exception.filter.js');
const { ResponseInterceptor } = await import('../dist/common/interceptors/response.interceptor.js');
const smoke = process.argv.includes('--smoke');
const port = smoke ? 0 : 4010;
const database = new PGlite();
let app;
try {
  const migrations = new URL('../../../packages/database/src/migrations/', import.meta.url);
  const journal = JSON.parse(await readFile(new URL('meta/_journal.json', migrations), 'utf8'));
  for (const entry of journal.entries) await database.exec(await readFile(new URL(`${entry.tag}.sql`, migrations), 'utf8'));
  class LocalDatabase {}
  Global()(LocalDatabase);
  Module({ providers: [{ provide: DATABASE, useValue: drizzle(database) }], exports: [DATABASE] })(LocalDatabase);
  class ProtectedController { check() { return { verified: true }; } }
  Controller({ path: 'prototype', version: '1' })(ProtectedController);
  Get('protected')(ProtectedController.prototype, 'check', Object.getOwnPropertyDescriptor(ProtectedController.prototype, 'check'));
  const config = {
    app: { nodeEnv: 'development', publicBaseUrl: `http://127.0.0.1:${port}` },
    auth: { jwt: { access: { secret: randomBytes(32).toString('hex'), ttlSeconds: 900 }, refresh: { secret: randomBytes(32).toString('hex'), ttlSeconds: 86400 } } },
    mail: { provider: 'recorder', devInbox: true },
  };
  class LocalVerificationModule {}
  Module({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, ignoreEnvVars: true, load: [() => config] }), LocalDatabase, AuthModule], controllers: [ProtectedController] })(LocalVerificationModule);
  if (smoke) {
    // Deterministic DNS only in the explicit test run, never in the normal lab.
    const { Test } = await import('@nestjs/testing');
    const module = await Test.createTestingModule({ imports: [LocalVerificationModule] }).overrideProvider(EMAIL_DNS).useValue({ acceptsMail: async domain => domain === 'example.test' }).compile();
    app = module.createNestApplication({ logger: false });
  } else app = await NestFactory.create(LocalVerificationModule, { logger: ['error'] });
  app.use(helmet());
  app.useBodyParser('json', { limit: '16kb' });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new BusinessExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalGuards(app.get(JwtAuthGuard));
  const adapter = app.getHttpAdapter();
  app.use((request, response, next) => {
    // Prevent browser DNS-rebinding and cross-site writes to this local lab.
    const host = request.headers.host ?? '';
    const origin = request.headers.origin;
    if (!/^((127\.0\.0\.1)|(localhost)):\d+$/.test(host) || (origin && origin !== `http://${host}`)) return response.status(403).end();
    next();
  });
  const assets = new URL('./local-verification/', import.meta.url);
  const html = await readFile(new URL('index.html', assets), 'utf8');
  adapter.get('/', (_request, response) => response.type('html').send(html));
  adapter.get('/auth/verify-email', (_request, response) => response.setHeader('Referrer-Policy', 'no-referrer').type('html').send(html));
  for (const [name, type] of [['prototype.js', 'application/javascript'], ['prototype.css', 'text/css']]) {
    const content = await readFile(new URL(name, assets), 'utf8');
    adapter.get(`/${name}`, (_request, response) => response.type(type).send(content));
  }
  await app.listen(port, '127.0.0.1');
  const base = await app.getUrl();
  config.app.publicBaseUrl = base;
  if (smoke) {
    const post = async (path, body) => fetch(`${base}/api/v1${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const invalid = await post('/auth/register', { displayName: 'Test', email: 'asdas@kdasf.csid', password: 'Test-only-password1!' });
    assert.equal(invalid.status, 400);
    const created = await post('/auth/register', { displayName: 'Test', email: 'test@example.test', password: 'Test-only-password1!' });
    assert.equal(created.status, 201);
    const session = (await created.json()).data;
    const headers = { Authorization: `Bearer ${session.tokens.accessToken}` };
    assert.equal((await fetch(`${base}/api/v1/prototype/protected`, { headers })).status, 403);
    const inbox = (await (await fetch(`${base}/api/v1/dev/mail`)).json()).data;
    assert.equal(inbox.messages.length, 1);
    const token = new URL(inbox.messages[0].text.match(/https?:\/\/\S+/)[0]).searchParams.get('token');
    assert.equal((await post('/auth/verify-email', { token })).status, 200);
    assert.equal((await fetch(`${base}/api/v1/prototype/protected`, { headers })).status, 200);
    assert.equal((await post('/auth/verify-email', { token })).status, 410);
    console.log('Local verification smoke passed: invalid domain rejected, inbox captured, access blocked then allowed, token replay rejected. DNS stubbed for this test only.');
    await app.close(); await database.close();
  } else {
    console.log(`Local verification lab: ${base}\nDisposable data only. No real emails sent. Press Ctrl+C to stop.`);
    let stopping = false;
    const close = async () => { if (stopping) return; stopping = true; await app.close(); await database.close(); process.exit(0); };
    process.on('SIGINT', () => void close()); process.on('SIGTERM', () => void close());
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to start local verification lab');
  if (app) await app.close();
  await database.close(); process.exitCode = 1;
}
