# Phase 6: Users Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build user management pages — list view with search/pagination/sort, and detail view with profile header, membership info, and activity timeline.

**Architecture:** Two routes under `apps/web/app/users/`. List fetches from `GET /users` with query params. Detail fetches from `GET /users/:id`. Uses existing API client pattern from earlier phases.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, lucide-react

## Global Constraints

- Search debounce 200ms
- Pagination uses page number buttons (not infinite scroll)
- Delete confirmation modal before removing users
- Empty state shown when no users match search/filter
- Skeleton loading with shimmer animation (reuse from Phase 2)
- No new npm dependencies

---

### Task 1: Users API service

**Files:**
- Create: `apps/web/lib/api/users.ts`
- Modify: `apps/web/lib/api/index.ts` (if barrel export exists)

- [ ] **Step 1: Create users API methods**

```ts
// apps/web/lib/api/users.ts
import { api } from '../client'; // adjust import path to match existing API client

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  status: 'active' | 'inactive' | 'suspended';
  emailVerified: boolean;
  timezone?: string;
  locale?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserListParams {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'email' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const usersApi = {
  list: (params: UserListParams = {}) =>
    api.get<PaginatedResponse<User>>('/users', { params }),

  get: (id: string) =>
    api.get<User>(`/users/${id}`),

  delete: (id: string) =>
    api.delete(`/users/${id}`),
};
```

- [ ] **Step 2: Export from API barrel**

If `apps/web/lib/api/index.ts` exists, add `export { usersApi } from './users'`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/api/users.ts
git commit -m "feat(api): add users API service with list/get/delete methods"
```

---

### Task 2: User list page — layout, search, pagination

**Files:**
- Create: `apps/web/app/users/page.tsx`
- Create: `apps/web/components/users-table.tsx`
- Create: `apps/web/components/users-pagination.tsx`

- [ ] **Step 1: Create user list page with search and pagination state**

```tsx
// apps/web/app/users/page.tsx
'use client';

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [users, setUsers] = useState<User[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch users
  useEffect(() => {
    setLoading(true);
    usersApi.list({ search: debouncedSearch, page, sortBy, sortOrder })
      .then((res) => { setUsers(res.data); setTotalPages(res.totalPages); })
      .finally(() => setLoading(false));
  }, [debouncedSearch, page, sortBy, sortOrder]);

  // ...
}
```

- [ ] **Step 2: Build users table component**

```tsx
// apps/web/components/users-table.tsx
interface UsersTableProps {
  users: User[];
  loading: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (column: string) => void;
  onDelete: (user: User) => void;
}
```

Columns:
- Avatar (small circle with fallback initial)
- Name (link to `/users/{id}`)
- Email
- Status (badge: green for active, yellow for inactive, red for suspended)
- Email verified (checkmark or x icon)
- Join date (formatted relative or absolute)

Sortable headers: Name, Email, Join date. Clicking toggles asc/desc. Active sort column highlighted with arrow icon.

Skeleton rows when loading: 6 rows of shimmer placeholders matching column widths.

- [ ] **Step 3: Build pagination component**

```tsx
// apps/web/components/users-pagination.tsx
interface UsersPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
```

Render page number buttons: first, prev, page numbers with ellipsis, next, last. Active page highlighted. Disabled state for first/last boundaries.

- [ ] **Step 4: Wire delete with confirmation modal**

```tsx
// In users page
const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);

// Confirmation modal
{deleteConfirm && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="w-full max-w-sm rounded-2xl border border-surface-700 bg-surface-900 p-6 shadow-2xl">
      <h3 className="text-lg font-semibold">Delete user</h3>
      <p className="mt-2 text-sm text-surface-400">
        Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={() => setDeleteConfirm(null)}>Cancel</button>
        <button onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white">Delete</button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Empty state**

When `!loading && users.length === 0`:

```tsx
<div className="flex flex-col items-center justify-center py-24">
  <Users size={40} className="text-surface-600" />
  <h3 className="mt-4 text-lg font-semibold text-surface-300">
    {debouncedSearch ? 'No users found' : 'No users yet'}
  </h3>
  <p className="mt-1 text-sm text-surface-500">
    {debouncedSearch ? 'Try adjusting your search query' : 'Users will appear here once they join'}
  </p>
</div>
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/users/ apps/web/components/users-table.tsx apps/web/components/users-pagination.tsx
git commit -m "feat(users): add user list page with search, pagination, sort, delete confirmation"
```

---

### Task 3: User detail page — profile header and detail card

**Files:**
- Create: `apps/web/app/users/[id]/page.tsx`

- [ ] **Step 1: Fetch user and render profile header**

```tsx
// apps/web/app/users/[id]/page.tsx
export default function UserDetailPage({ params }: { params: { id: string } }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.get(params.id)
      .then(setUser)
      .finally(() => setLoading(false));
  }, [params.id]);
```

Profile header:

```tsx
<div className="flex items-center gap-6 border-b border-surface-800 pb-6">
  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-700 text-3xl font-bold text-surface-400">
    {user.avatarUrl ? <img src={user.avatarUrl} className="h-full w-full rounded-full object-cover" /> : user.name.charAt(0)}
  </div>
  <div>
    <h1 className="text-2xl font-bold">{user.name}</h1>
    <p className="text-sm text-surface-400">{user.email}</p>
    <StatusBadge status={user.status} />
  </div>
</div>
```

Back arrow button at top-left that navigates to `/users`.

- [ ] **Step 2: Detail card with 2-column grid**

```tsx
<div className="mt-6 rounded-xl border border-surface-800 bg-surface-900/50 p-6">
  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">Details</h2>
  <div className="grid grid-cols-2 gap-6">
    <DetailField label="Email" value={user.email} />
    <DetailField label="Status">
      <StatusBadge status={user.status} />
    </DetailField>
    <DetailField label="Email verified">
      {user.emailVerified ? <Check size={16} className="text-emerald-500" /> : <X size={16} className="text-red-500" />}
    </DetailField>
    <DetailField label="Timezone" value={user.timezone || '—'} />
    <DetailField label="Locale" value={user.locale || '—'} />
    <DetailField label="Joined" value={formatDate(user.createdAt)} />
    <DetailField label="Bio" value={user.bio || '—'} className="col-span-2" />
  </div>
</div>
```

- [ ] **Step 3: Add edit/own profile button**

If the current user's session matches this user ID, show an "Edit profile" button that links to `/settings?tab=profile`. Otherwise show no edit button.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/users/[id]/page.tsx
git commit -m "feat(users): add user detail page with profile header and detail card"
```

---

### Task 4: Workspace memberships section

**Files:**
- Modify: `apps/web/app/users/[id]/page.tsx`
- Create: `apps/web/lib/api/workspaces.ts` (if not already existing)

- [ ] **Step 1: Fetch user's workspace memberships**

```ts
interface UserMembership {
  workspaceId: string;
  workspaceName: string;
  role: 'admin' | 'member' | 'viewer';
  joinedAt: string;
}
```

Add to `usersApi` or use existing `workspacesApi.listUserMemberships(userId)`.

- [ ] **Step 2: Render memberships section**

```tsx
<div className="mt-6 rounded-xl border border-surface-800 bg-surface-900/50 p-6">
  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
    Workspace memberships ({memberships.length})
  </h2>
  <div className="space-y-2">
    {memberships.map((m) => (
      <Link
        key={m.workspaceId}
        href={`/workspaces/${m.workspaceId}`}
        className="flex items-center justify-between rounded-lg px-4 py-3 transition-colors hover:bg-surface-800"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-700 text-xs font-bold">
            {m.workspaceName.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium">{m.workspaceName}</p>
            <p className="text-xs text-surface-500">Joined {formatRelativeDate(m.joinedAt)}</p>
          </div>
        </div>
        <span className="rounded-md bg-surface-800 px-2 py-0.5 text-xs capitalize text-surface-400">{m.role}</span>
      </Link>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/users/[id]/page.tsx
git commit -m "feat(users): add workspace memberships section to user detail page"
```

---

### Task 5: User activity timeline

**Files:**
- Modify: `apps/web/app/users/[id]/page.tsx`
- Create: `apps/web/lib/api/audit-logs.ts` (if not already created in Phase 3)

- [ ] **Step 1: Fetch audit logs for the user**

Use the audit log API from Phase 3, filtering by `userId`:

```ts
const [activities, setActivities] = useState<AuditLog[]>([]);

useEffect(() => {
  auditLogsApi.list({ userId: params.id, limit: 20 })
    .then(setActivities);
}, [params.id]);
```

- [ ] **Step 2: Render timeline UI**

```tsx
<div className="mt-6 rounded-xl border border-surface-800 bg-surface-900/50 p-6">
  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">Activity</h2>
  {activities.length === 0 ? (
    <p className="py-8 text-center text-sm text-surface-500">No recent activity</p>
  ) : (
    <div className="relative space-y-0">
      {activities.map((log, i) => (
        <div key={log.id} className="flex gap-4 pb-4">
          {/* Timeline line + dot */}
          <div className="flex flex-col items-center">
            <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full bg-surface-800">
              {actionIcon(log.action)}
            </div>
            {i < activities.length - 1 && <div className="mt-1 w-px flex-1 bg-surface-800" />}
          </div>
          {/* Content */}
          <div className="flex-1 pb-2">
            <p className="text-sm text-surface-300">{formatAction(log)}</p>
            <p className="text-xs text-surface-500">{formatRelativeDate(log.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

Helper `actionIcon` maps action types to lucide icons (e.g., `LogIn` for login, `Edit3` for update, `Trash2` for delete).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/users/[id]/page.tsx
git commit -m "feat(users): add activity timeline to user detail page using audit logs"
```
