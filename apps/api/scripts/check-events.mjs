import assert from 'node:assert/strict';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

delete process.env.DATABASE_URL;
const requireDatabase = createRequire(new URL('../../../packages/database/package.json', import.meta.url));
const { PGlite } = requireDatabase('@electric-sql/pglite');
const { drizzle } = requireDatabase('drizzle-orm/pglite');
const schema = await import('../../../packages/database/dist/index.js');
const { EventsService } = await import('../dist/modules/events/events.service.js');
const { SaveEventDto } = await import('../dist/modules/events/event.dto.js');
const { EventsModule } = await import('../dist/modules/events/events.module.js');
const { DatabaseModule } = await import('../dist/infrastructure/database/database.module.js');
const database = new PGlite();
const db = drizzle(database);
const migrations = new URL('../../../packages/database/src/migrations/', import.meta.url);
const journal = JSON.parse(await readFile(new URL('meta/_journal.json', migrations), 'utf8'));
try {
  for (const entry of journal.entries) await database.exec(await readFile(new URL(`${entry.tag}.sql`, migrations), 'utf8'));
  const owner = randomUUID(), other = randomUUID();
  for (const id of [owner, other]) await db.insert(schema.users).values({ id, email: `${id}@example.test`, displayName: 'Events test', passwordHash: 'test-only' });
  const service = new EventsService(db);
  const now = Date.now();
  const input = { title: ' Design review ', startsAt: new Date(now + 3600000).toISOString(), endsAt: new Date(now + 7200000).toISOString(), location: ' Room A ', notes: 'Private notes' };
  // Exercise the actual HTTP DTO/UUID pipeline with an isolated test identity.
  // Production authentication remains the application's global JWT guard.
  const module = await Test.createTestingModule({ imports: [DatabaseModule, EventsModule] }).overrideProvider(schema.DATABASE).useValue(db).compile();
  const app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.use((req, _res, next) => { req.user = { id: req.headers['x-event-user'] ?? owner }; next(); });
  await app.init();
  try {
    const http = request(app.getHttpServer());
    const created = await http.post('/api/v1/events').send(input).expect(201);
    await http.put(`/api/v1/events/${created.body.id}`).set('x-event-user', other).send(input).expect(404);
    await http.delete(`/api/v1/events/${created.body.id}`).set('x-event-user', other).expect(404);
    await http.post('/api/v1/events').send({ ...input, userId: other }).expect(400);
    await http.put('/api/v1/events/not-a-uuid').send(input).expect(400);
    await http.post('/api/v1/events').send({ ...input, endsAt: input.startsAt }).expect(400);
    await http.delete(`/api/v1/events/${created.body.id}`).expect(204);
  } finally { await app.close(); }
  assert.equal((await validate(plainToInstance(SaveEventDto, input))).length, 0);
  for (const invalid of [{ ...input, title: '  ' }, { ...input, title: 'a'.repeat(161) }, { ...input, startsAt: 'invalid' }, { ...input, startsAt: '2026-12-01T12:00:00' }, { ...input, notes: 'x'.repeat(2001) }]) {
    assert.ok((await validate(plainToInstance(SaveEventDto, invalid))).length > 0);
  }
  const event = await service.create(owner, input);
  assert.equal(event.title, 'Design review');
  assert.equal(event.location, 'Room A');
  assert.equal((await service.list(owner)).length, 1);
  assert.equal((await service.list(other)).length, 0);
  const notFound = (error) => error.getStatus?.() === 404;
  await assert.rejects(service.update(other, event.id, input), notFound);
  await assert.rejects(service.remove(other, event.id), notFound);
  await assert.rejects(service.update(owner, randomUUID(), input), notFound);
  await assert.rejects(service.create(owner, { ...input, endsAt: input.startsAt }));
  await assert.rejects(service.create(owner, { ...input, endsAt: new Date(now).toISOString() }));
  const updated = await service.update(owner, event.id, { ...input, title: 'Updated review', endsAt: null, location: null, notes: null });
  assert.equal(updated.title, 'Updated review');
  assert.equal(updated.endsAt, null);
  assert.equal(updated.location, null);
  assert.equal(updated.notes, null);
  await service.create(owner, { ...input, title: 'Past', startsAt: new Date(now - 7200000).toISOString(), endsAt: new Date(now - 3600000).toISOString() });
  const ongoing = await service.create(owner, { ...input, title: 'Ongoing', startsAt: new Date(now - 1000).toISOString() });
  assert.deepEqual((await service.list(owner)).map((item) => item.id), [ongoing.id, event.id]);
  await service.remove(owner, event.id);
  assert.ok(!(await service.list(owner)).some((item) => item.id === event.id));
  await assert.rejects(service.update(owner, event.id, input), notFound);
  const [stored] = await db.select().from(schema.personalEvents).where(schema.eq(schema.personalEvents.id, event.id));
  assert.ok(stored.deletedAt, 'Deletion is recoverable soft deletion');
  assert.equal(stored.title, 'Updated review');
  for (let index = 0; index < 102; index++) await service.create(owner, { ...input, title: `Future ${index}`, startsAt: new Date(now + (index + 10) * 3600000).toISOString(), endsAt: null });
  const limited = await service.list(owner);
  assert.equal(limited.length, 100);
  assert.ok(limited.every((item, index) => index === 0 || item.startsAt >= limited[index - 1].startsAt));
  console.log('Events integration passed: migrations, validation, owner-only CRUD, timezone-aware dates, ongoing/upcoming ordering, 100-event limit and soft deletion.');
} finally { await database.close(); }
