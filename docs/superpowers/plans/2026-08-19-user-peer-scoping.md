# User Directory Peer-Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Scope the global user directory endpoints so users only see themselves and workspace peers (both memberships ACTIVE), returning 404 for everyone else.

**Architecture:** Peer scoping lives in the public entry points of `UsersService` (controller-facing methods take `requesterId`), using a new `WorkspaceMembersRepository.listPeerIds()` query and an optional `ids` filter on `UsersRepository.list()`/`countFiltered()` so pagination stays correct. `getProfile()` stays unscoped (shared internally by the canvas gateway). The workspace `getMembers` non-member check already exists and is tested — verification only.

**Tech Stack:** NestJS 11, Drizzle ORM (PostgreSQL), TypeScript, Jest (API unit tests with mocked `@repo/database`).

## Global Constraints

- **404, never 403** — non-peers are indistinguishable from nonexistent users (`UsersErrorCode.USER_NOT_FOUND` → 404).
- **ACTIVE-only peer rule** — both memberships must have `status = 'ACTIVE'` and `deletedAt IS NULL`; PENDING/SUSPENDED/REMOVED never count. Workspace archived status is irrelevant.
- **SQL-level filtering** — `listUsers` scopes via `WHERE id IN (...)` in the repository; never filter in memory after pagination.
- **`getProfile(id)` is NOT modified** — the canvas gateway (`canvas.gateway.ts:103`) depends on it.
- **No auto-commit** — the user must approve every commit. Code commits use the repo's default git identity (`sakib-mustafa-ak <sakib.mustafa.co@gmail.com>`); do NOT pass `-c user.*` flags.
- API unit tests mock `@repo/database` (see `apps/api/src/__mocks__/@repo/database`); repository SQL is verified via the Task 3 live smoke, not unit tests.

---

### Task 1: Peer-scoping queries

**Files:**
- Modify: `apps/api/src/modules/workspaces/repositories/workspace-members.repository.ts`
- Modify: `apps/api/src/modules/users/repositories/users.repository.ts`

**Interfaces:**
- Produces:
  - `WorkspaceMembersRepository.listPeerIds(userId: string): Promise<string[]>` — distinct active peers (excludes the requester)
  - `UsersRepository.list(opts & { ids?: string[] })` — `ids` filters to those users (plus existing search/sort/pagination)
  - `UsersRepository.countFiltered(search?: string, ids?: string[])` — same `ids` filter applied to the count

- [x] **Step 1: Add `listPeerIds` to `WorkspaceMembersRepository`**

Append to `apps/api/src/modules/workspaces/repositories/workspace-members.repository.ts` (extend the existing drizzle imports with `inArray`, `ne`):

```ts
public async listPeerIds(userId: string): Promise<string[]> {
  const shared = await this.db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.status, 'ACTIVE'),
        sql`${workspaceMembers.deletedAt} IS NULL`,
      ),
    );
  if (shared.length === 0) return [];
  const ids = shared.map((r) => r.workspaceId);
  const rows = await this.db
    .selectDistinct({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        inArray(workspaceMembers.workspaceId, ids),
        eq(workspaceMembers.status, 'ACTIVE'),
        sql`${workspaceMembers.deletedAt} IS NULL`,
        ne(workspaceMembers.userId, userId),
      ),
    );
  return rows.map((r) => r.userId);
}
```

Check the file's import block — it currently imports `and, DATABASE, eq, sql`; add `inArray, ne` from `drizzle-orm`.

- [x] **Step 2: Add the `ids` filter to `UsersRepository.list` and `countFiltered`**

In `apps/api/src/modules/users/repositories/users.repository.ts`:

```ts
public async list(
  opts: {
    limit?: number;
    offset?: number;
    search?: string;
    sortBy?: 'displayName' | 'email' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
    ids?: string[];
  } = {},
): Promise<UserRow[]> {
  const { limit = 20, offset = 0 } = opts;
  const conditions = [sql`${users.deletedAt} IS NULL`];
  if (opts.ids && opts.ids.length > 0) {
    conditions.push(inArray(users.id, opts.ids));
  }
  // ...rest unchanged
```

and:

```ts
public async countFiltered(search?: string, ids?: string[]): Promise<number> {
  const conditions = [sql`${users.deletedAt} IS NULL`];
  if (ids && ids.length > 0) {
    conditions.push(inArray(users.id, ids));
  }
  // ...rest unchanged
```

Add `inArray` to the drizzle imports in that file.

- [x] **Step 3: Typecheck**

Run: `pnpm --filter api exec tsc --noEmit`
Expected: no errors.

- [x] **Step 4: Ask the user to commit** (do not commit automatically).

---

### Task 2: Service gates, controller wiring, and unit tests

**Files:**
- Modify: `apps/api/src/modules/users/services/users.service.ts`
- Modify: `apps/api/src/modules/users/controllers/users.controller.ts`
- Create: `apps/api/src/modules/users/services/users.service.spec.ts`

**Interfaces:**
- Consumes: `WorkspaceMembersRepository.listPeerIds`, `UsersRepository.list({ ids })`, `UsersRepository.countFiltered(search, ids)` from Task 1.
- Produces:
  - `UsersService.getUserById(id: string, requesterId: string): Promise<UserRow>`
  - `UsersService.listUsers(opts, requesterId: string): Promise<{ users: UserRow[]; total: number }>`
  - `UsersService.getUserMemberships(userId: string, requesterId: string)`
  - `UsersService.getUserActivity(userId: string, requesterId: string, limit?: number)`

- [x] **Step 1: Write the failing unit tests** — create `apps/api/src/modules/users/services/users.service.spec.ts` (mirror the fixture style of `apps/api/src/modules/workspaces/services/workspaces.service.spec.ts`):

```ts
import { Test, TestingModule } from '@nestjs/testing';

import { DATABASE, type UserRow } from '@repo/database';

import { AuditRepository } from '../../audit/repositories/audit.repository';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';
import { UsersEventBus } from '../events/users.events';
import { UsersRepository } from '../repositories/users.repository';
import { UsersErrorCode, UsersException } from '../errors/users.errors';
import { UsersService } from './users.service';

const makeUser = (id: string, displayName: string, email: string): UserRow => ({
  id,
  displayName,
  email,
  passwordHash: 'hash',
  status: 'ACTIVE',
  avatarUrl: null,
  bio: null,
  timezone: null,
  locale: null,
  lastLoginAt: null,
  emailVerifiedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

describe('UsersService', () => {
  let service: UsersService;
  let users: jest.Mocked<UsersRepository>;
  let members: jest.Mocked<WorkspaceMembersRepository>;
  let audit: jest.Mocked<AuditRepository>;
  let events: jest.Mocked<UsersEventBus>;

  const alice = makeUser('u1', 'Alice', 'alice@example.com');
  const bob = makeUser('u2', 'Bob', 'bob@example.com');
  const mallory = makeUser('u3', 'Mallory', 'mallory@example.com');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DATABASE, useValue: { transaction: jest.fn() } },
        {
          provide: UsersRepository,
          useValue: {
            findById: jest.fn(),
            list: jest.fn(),
            countFiltered: jest.fn(),
            updateProfile: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: WorkspaceMembersRepository,
          useValue: { listPeerIds: jest.fn(), listByUserWithWorkspace: jest.fn() },
        },
        { provide: AuditRepository, useValue: { listByUser: jest.fn() } },
        {
          provide: UsersEventBus,
          useValue: {
            publishUserProfileUpdated: jest.fn(),
            publishUserAccountDeleted: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    users = module.get(UsersRepository);
    members = module.get(WorkspaceMembersRepository);
    audit = module.get(AuditRepository);
    events = module.get(UsersEventBus);
  });

  it('getUserById returns self without a peer query', async () => {
    users.findById.mockResolvedValue(alice);
    await expect(service.getUserById('u1', 'u1')).resolves.toBe(alice);
    expect(members.listPeerIds).not.toHaveBeenCalled();
  });

  it('getUserById returns a peer profile', async () => {
    users.findById.mockResolvedValue(bob);
    members.listPeerIds.mockResolvedValue(['u2']);
    await expect(service.getUserById('u2', 'u1')).resolves.toBe(bob);
  });

  it('getUserById 404s for a non-peer', async () => {
    members.listPeerIds.mockResolvedValue(['u2']);
    await expect(service.getUserById('u3', 'u1')).rejects.toThrow(
      new UsersException(UsersErrorCode.USER_NOT_FOUND, 'User not found.'),
    );
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('listUsers scopes to peers + self in SQL', async () => {
    members.listPeerIds.mockResolvedValue(['u2']);
    users.list.mockResolvedValue([alice, bob]);
    users.countFiltered.mockResolvedValue(2);
    await service.listUsers({}, 'u1');
    expect(users.list).toHaveBeenCalledWith(
      expect.objectContaining({ ids: ['u1', 'u2'] }),
    );
    expect(users.countFiltered).toHaveBeenCalledWith(undefined, ['u1', 'u2']);
  });

  it('getUserMemberships 404s for a non-peer', async () => {
    members.listPeerIds.mockResolvedValue(['u2']);
    await expect(service.getUserMemberships('u3', 'u1')).rejects.toThrow(
      new UsersException(UsersErrorCode.USER_NOT_FOUND, 'User not found.'),
    );
    expect(members.listByUserWithWorkspace).not.toHaveBeenCalled();
  });

  it('getUserActivity 404s for a non-peer', async () => {
    members.listPeerIds.mockResolvedValue(['u2']);
    await expect(service.getUserActivity('u3', 'u1')).rejects.toThrow(
      new UsersException(UsersErrorCode.USER_NOT_FOUND, 'User not found.'),
    );
    expect(audit.listByUser).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api test users.service`
Expected: FAIL — `getUserById` does not exist.

- [x] **Step 3: Implement the service gates** — in `apps/api/src/modules/users/services/users.service.ts`, add a private gate helper and change the four public entry points:

```ts
private async assertVisible(id: string, requesterId: string): Promise<void> {
  if (id === requesterId) return;
  const peers = await this.membersRepo.listPeerIds(requesterId);
  if (!peers.includes(id)) {
    throw new UsersException(
      UsersErrorCode.USER_NOT_FOUND,
      'User not found.',
    );
  }
}

public async getUserById(id: string, requesterId: string): Promise<UserRow> {
  await this.assertVisible(id, requesterId);
  return this.getProfile(id);
}

public async listUsers(
  opts: {
    limit?: number;
    offset?: number;
    search?: string;
    sortBy?: 'displayName' | 'email' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  } = {},
  requesterId: string,
): Promise<{ users: UserRow[]; total: number }> {
  const ids = [requesterId, ...(await this.membersRepo.listPeerIds(requesterId))];
  const [rows, total] = await Promise.all([
    this.users.list({ ...opts, ids }),
    this.users.countFiltered(opts.search, ids),
  ]);
  return { users: rows, total };
}

public async getUserMemberships(userId: string, requesterId: string) {
  await this.assertVisible(userId, requesterId);
  const memberships = await this.membersRepo.listByUserWithWorkspace(userId);
  return memberships.map((m) => ({
    workspaceId: m.workspaceId,
    workspaceName: m.workspaceName,
    role: m.role,
    joinedAt: m.joinedAt?.toISOString() ?? null,
  }));
}

public async getUserActivity(
  userId: string,
  requesterId: string,
  limit = 20,
) {
  await this.assertVisible(userId, requesterId);
  const rows = await this.auditRepo.listByUser(userId, limit);
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.resourceType,
    entityId: r.resourceId,
    metadata: r.metadata ?? {},
    createdAt: r.createdAt.toISOString(),
  }));
}
```

Do NOT modify `getProfile` or `updateProfile`/`deleteAccount`.

- [x] **Step 4: Wire the controller** — in `apps/api/src/modules/users/controllers/users.controller.ts`:

- `getUserById`: change `const profile = await this.users.getProfile(id);` to `const profile = await this.users.getUserById(id, user.id);` and add `@CurrentUser() user: CurrentUserModel` as a parameter.
- `getUserMemberships`: add `@CurrentUser() user: CurrentUserModel` parameter, pass `(id, user.id)`.
- `getUserActivity`: same — pass `(id, user.id)`.
- `listUsers`: add `@CurrentUser() user: CurrentUserModel` parameter and pass `user.id` as the second argument:

```ts
return this.users.listUsers(
  {
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
    page: page ? Number(page) : undefined,
    search,
    sortBy: sortBy as 'displayName' | 'email' | 'createdAt',
    sortOrder: sortOrder as 'asc' | 'desc',
  },
  user.id,
);
```

(Match the existing argument construction already in the method — only add the second argument.)

- [x] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter api test users.service`
Expected: PASS (6 new tests).

- [x] **Step 6: Run the full API suite and typecheck**

Run: `pnpm --filter api test` then `pnpm --filter api exec tsc --noEmit`
Expected: 29 suites + the new spec, all green; tsc clean. This also exercises the existing
non-member `getMembers` rejection test in `workspaces.service.spec.ts` (spec item 2 — no code
change needed there). (`pnpm run lint` runs in Task 3.)

- [x] **Step 7: Ask the user to commit.**

---

### Task 3: borderGlow fix + full verification

**Files:**
- Modify: `apps/web/app/globals.css` (lines ~67-68, the `borderGlow` keyframe)

- [x] **Step 1: Fix the borderGlow keyframe**

```css
@keyframes borderGlow {
  0%, 100% { border-color: rgb(214 207 225 / 0.3); }
  50% { border-color: rgb(214 207 225 / 0.6); }
}
```

(Old values were `rgb(59 130 246 / 0.3)` and `rgb(59 130 246 / 0.6)` — the pre-rebrand blue.)

- [x] **Step 2: Lint + typecheck everything**

Run: `pnpm run lint` (web `--max-warnings 0` must stay clean; api's 15 pre-existing spec warnings are expected) and `pnpm --filter web exec tsc --noEmit`.
Expected: both pass.

- [x] **Step 3: Live smoke over the running stack** — start the API against the local Postgres (postgres/redis are still running; ports 3000/4000 are free):

```bash
cd /home/sakib/Projects/workspace-app && setsid env CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000 pnpm --filter api dev > /tmp/opencode/api-dev.log 2>&1 < /dev/null &
```

Then (curl against `http://localhost:4000/api/v1`):
1. Register two fresh users `alice_{ts}` and `bob_{ts}` (`POST /auth/register` with `{email, password, displayName}` — password must satisfy the auth rules, e.g. `ProbePass123!`) → capture both access tokens.
2. Alice creates a workspace (`POST /workspaces` `{name}`) → capture `id`.
3. As ALICE: `GET /users` → must contain only alice (+ any legacy peers) — record result. `GET /users/{bob_id}` → expect **404**.
4. Alice invites bob (`POST /workspaces/{id}/invitations` `{email: bob_email, role: 'EDITOR'}`) → capture the returned selector/verifier (if the response has one `token` field, split it on `.` — first part is the selector, the rest is the verifier).
5. Bob accepts (`POST /workspaces/invitations/accept` `{selector, verifier}`).
6. As ALICE again: `GET /users/{bob_id}` → **200** with bob's profile; `GET /users?search=bob` → contains bob.
7. As ALICE: `GET /users/{mallory_id}` for a third registered user → **404**; `GET /users` total excludes mallory.
8. Register `mallory_{ts}` first (before step 7) to have a non-peer.

Record the exact responses in the task report.

- [x] **Step 4: Stop the API dev server** (kill the `:4000` listener; use `ss -tlnp` to find the PID — never `pkill -f "next-server"`).

- [x] **Step 5: Ask the user to commit** (globals.css) — then the final commit batch is complete and the work can be pushed (Vercel/Render deploy automatically).

---

## Post-execution notes (committed 2026-08-19)

- **Commits:** `0a61b54` (Task 1), `167bbdb` (Task 2), `1f697ef` (Task 3) — all user-approved, repo default identity; plus `4d93407` (text-coloring upgrade, interleaved user request).
- **Task 2 correction:** `users.service.spec.ts` already existed at HEAD with 12 tests (parallel-session code) — the plan's "Create" instruction was wrong. Final spec merges the 12 original + 6 new peer-scoping tests (18 total); `users.controller.spec.ts` also needed minimal updates for the new `@CurrentUser` signatures (authorized deviation).
- **Task 3 correction:** invitation tokens split on `:` (selector:verifier), not `.` — smoke used colon (workspaces.controller.ts:207).
- **Pre-existing (unrelated, out of scope):** `GET /users/:id/activity` 500s against local Postgres — `audit_events` table exists in migrations but was never applied locally (local DB migration gap, not a code bug). Follow-up: apply pending drizzle migrations or guard the query.
- **tsc baseline:** 2 pre-existing errors in `comments.service.spec.ts:197-198` (present at HEAD before this plan; all other suites pass 232/232).