import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

delete process.env.DATABASE_URL;
const requireDatabase = createRequire(new URL('../../../packages/database/package.json', import.meta.url));
const { PGlite } = requireDatabase('@electric-sql/pglite');
const { drizzle } = requireDatabase('drizzle-orm/pglite');
const schema = await import('../../../packages/database/dist/index.js');
const { BoardAccessService } = await import('../dist/common/board-access/board-access.service.js');
const { BoardAccessGuard } = await import('../dist/common/board-access/board-access.guard.js');
const { BoardPresenceService } = await import('../dist/common/board-access/board-presence.service.js');
const { WorkspaceHomeService } = await import('../dist/common/board-access/workspace-home.service.js');
const { BoardsRepository } = await import('../dist/modules/boards/repositories/boards.repository.js');
const { TasksRepository } = await import('../dist/modules/tasks/repositories/tasks.repository.js');
const { UploadsRepository } = await import('../dist/modules/uploads/repositories/uploads.repository.js');
const { NotificationsRepository } = await import('../dist/modules/notifications/repositories/notifications.repository.js');
const database = new PGlite();
const db = drizzle(database);
const migrations = new URL('../../../packages/database/src/migrations/', import.meta.url);
const journal = JSON.parse(await readFile(new URL('meta/_journal.json', migrations), 'utf8'));
try {
  for (const entry of journal.entries) await database.exec(await readFile(new URL(`${entry.tag}.sql`, migrations), 'utf8'));
  const [owner, allowed, excluded, outsider] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  for (const [index, id] of [owner, allowed, excluded, outsider].entries()) await db.insert(schema.users).values({ id, email: `home${index}@example.test`, displayName: `Member ${index}`, passwordHash: 'test-only' });
  const [workspace] = await db.insert(schema.workspaces).values({ name: 'Home test', slug: 'home-test', ownerId: owner }).returning();
  for (const id of [owner, allowed, excluded]) await db.insert(schema.workspaceMembers).values({ workspaceId: workspace.id, userId: id, role: id === owner ? 'OWNER' : 'EDITOR', status: 'ACTIVE', joinedAt: new Date() });
  const [publicBoard, privateBoard] = await db.insert(schema.boards).values([{ name: 'Public priority', workspaceId: workspace.id, position: 0 }, { name: 'Secret priority', workspaceId: workspace.id, position: 1 }]).returning();
  assert.equal(privateBoard.accessUserIds, null, 'Existing boards remain shared by default');
  const [column, privateColumn] = await db.insert(schema.boardColumns).values([{ boardId: publicBoard.id, name: 'To do', position: 0 }, { boardId: privateBoard.id, name: 'To do', position: 0 }]).returning();
  const access = new BoardAccessService(db);
  let changed = false;
  access.onChanged(() => { changed = true; });
  await access.set(privateBoard.id, owner, workspace.id, [allowed]);
  assert.equal(changed, true);
  await assert.rejects(access.require(privateBoard.id, excluded));
  await assert.rejects(access.require(privateBoard.id, outsider));
  await assert.rejects(access.set(privateBoard.id, allowed, workspace.id, [excluded]));
  await assert.rejects(access.set(privateBoard.id, owner, workspace.id, [outsider]));
  await access.require(privateBoard.id, owner);
  await access.require(privateBoard.id, allowed);
  const due = new Date();
  due.setHours(10, 0, 0, 0);
  const privateTasks = [];
  for (const [position, priority] of ['LOW', 'HIGH', 'CRITICAL', 'MEDIUM'].entries()) {
    const [task] = await db.insert(schema.tasks).values({ workspaceId: workspace.id, boardId: privateBoard.id, columnId: privateColumn.id, title: `Secret priority ${priority}`, priority, position, assigneeId: excluded, createdById: owner, dueDate: due }).returning();
    privateTasks.push(task);
  }
  await db.insert(schema.tasks).values({ workspaceId: workspace.id, boardId: publicBoard.id, columnId: column.id, title: 'Public priority task', assigneeId: excluded, createdById: owner, dueDate: due });
  const presence = new BoardPresenceService();
  presence.join('socket', allowed, 'Allowed', privateBoard.id);
  const home = new WorkspaceHomeService(db, presence);
  const excludedHome = await home.get(workspace.id, excluded, new Date().getTimezoneOffset());
  assert.deepEqual(excludedHome.boards.map((board) => board.id), [publicBoard.id]);
  assert.equal(excludedHome.todayTasks.length, 1);
  const allowedHome = await home.get(workspace.id, allowed, new Date().getTimezoneOffset());
  const preview = allowedHome.boards.find((board) => board.id === privateBoard.id);
  assert.deepEqual(preview.topTasks.map((task) => task.priority), ['CRITICAL', 'HIGH', 'MEDIUM']);
  assert.equal(preview.activeUsers.length, 1);
  // Tomorrow begins at local midnight; today's tasks must not be duplicated.
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);
  const upcomingBase = { workspaceId: workspace.id, boardId: publicBoard.id, columnId: column.id, assigneeId: excluded, createdById: owner, dueDate: tomorrow };
  await db.insert(schema.tasks).values([
    { ...upcomingBase, title: 'Upcoming low', priority: 'LOW' },
    { ...upcomingBase, title: 'Upcoming high', priority: 'HIGH' },
    ...Array.from({ length: 10 }, (_, index) => ({ ...upcomingBase, title: `Later ${index}`, dueDate: new Date(tomorrow.getTime() + (index + 1) * 86400000) })),
    { ...upcomingBase, title: 'Hidden future', boardId: privateBoard.id, columnId: privateColumn.id },
    { ...upcomingBase, title: 'Completed future', status: 'DONE' },
    { ...upcomingBase, title: 'Cancelled future', status: 'CANCELLED' },
    { ...upcomingBase, title: 'Someone else', assigneeId: owner },
    { ...upcomingBase, title: 'No date', dueDate: null },
  ]);
  const upcomingHome = await home.get(workspace.id, excluded, new Date().getTimezoneOffset());
  assert.equal(upcomingHome.todayTasks.length, 1);
  assert.equal(upcomingHome.upcomingLimit, 10);
  assert.equal(upcomingHome.upcomingTasks.length, 10);
  assert.deepEqual(upcomingHome.upcomingTasks.slice(0, 2).map((task) => task.title), ['Upcoming high', 'Upcoming low']);
  assert.equal(upcomingHome.upcomingTasks.at(-1).title, 'Later 7');
  assert.ok(upcomingHome.upcomingTasks.every((task) => task.boardId === publicBoard.id && task.assigneeId === excluded && new Date(task.dueDate) >= tomorrow));
  const boardsRepo = new BoardsRepository(db);
  const tasksRepo = new TasksRepository(db);
  assert.equal((await boardsRepo.listByWorkspace(workspace.id, excluded)).length, 1);
  assert.equal((await boardsRepo.searchByQuery([workspace.id], 'Secret', 20, excluded)).length, 0);
  assert.equal((await tasksRepo.searchByQuery([workspace.id], 'Secret', 20, excluded)).length, 0);
  const [file] = await db.insert(schema.uploadedFiles).values({ workspaceId: workspace.id, boardId: privateBoard.id, userId: owner, originalName: 'secret.txt', mimeType: 'text/plain', size: 10, storageKey: 'test-secret', provider: 'storage', url: '' }).returning();
  assert.equal((await new UploadsRepository(db).findByWorkspace(workspace.id, excluded)).length, 0);
  const notificationsRepo = new NotificationsRepository(db);
  assert.equal(await notificationsRepo.canReceive(excluded, 'board', privateBoard.id), false);
  assert.equal(await notificationsRepo.canReceive(allowed, 'task', privateTasks[0].id), true);
  await notificationsRepo.create({ userId: excluded, title: 'Secret board notice', type: 'BOARD_SHARED', resourceType: 'board', resourceId: privateBoard.id });
  assert.equal((await notificationsRepo.listByUser(excluded)).length, 0);
  const guard = new BoardAccessGuard(db, access);
  const context = (params, userId = excluded, body = {}) => ({ switchToHttp: () => ({ getRequest: () => ({ params: { workspaceId: workspace.id, ...params }, user: { id: userId }, body }) }) });
  await assert.rejects(guard.canActivate(context({ boardId: privateBoard.id })));
  await assert.rejects(guard.canActivate(context({ boardId: publicBoard.id, taskId: privateTasks[0].id })));
  await assert.rejects(guard.canActivate(context({ boardId: publicBoard.id, columnId: privateColumn.id })));
  await assert.rejects(guard.canActivate(context({ uploadId: file.id })));
  assert.equal(await guard.canActivate(context({ boardId: privateBoard.id }, allowed)), true);
  await access.set(privateBoard.id, owner, workspace.id, []);
  await assert.rejects(access.require(privateBoard.id, allowed));
  await access.set(privateBoard.id, owner, workspace.id, null);
  await access.require(privateBoard.id, excluded);
  console.log('Workspace home integration passed: safe migration, today and upcoming tasks, date boundaries, priority ordering, presence, per-board grants, forged parents, files and search visibility.');
} finally { await database.close(); }
