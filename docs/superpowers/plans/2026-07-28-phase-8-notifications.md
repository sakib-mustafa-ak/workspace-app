# Phase 8: Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full notifications system — dedicated page with filtering, dropdown with polling, unread badge, push notifications via Service Worker + VAPID.

**Architecture:** Notifications page at `apps/web/app/notifications/`. Dropdown component at `apps/web/components/notifications-dropdown.tsx`. Push notification backend endpoints alongside existing auth routes. Service Worker in `apps/web/public/sw.js`.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, lucide-react, Web Push API, Service Workers

## Global Constraints

- Polling interval for dropdown: 15s
- Dropdown max height: 300px with scroll
- Notifications grouped by date on the full page
- Optimistic UI for "mark all read" and archive actions
- Undo toast on archive (show for 5s with undo action)
- Swipe-to-dismiss on touch devices
- Unread badge has pulse animation
- No new npm dependencies (use native Web Push API)

---

### Task 1: Notifications API service

**Files:**
- Create: `apps/web/lib/api/notifications.ts`

- [ ] **Step 1: Create notifications API methods**

```ts
// apps/web/lib/api/notifications.ts
import { api } from '../client';

export type NotificationType = 'mention' | 'comment' | 'invitation' | 'update' | 'board_shared';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  resourceUrl?: string;
  read: boolean;
  archived: boolean;
  createdAt: string;
}

export interface NotificationsListParams {
  filter?: 'all' | 'unread' | 'archived';
  page?: number;
  limit?: number;
}

export const notificationsApi = {
  list: (params: NotificationsListParams = {}) =>
    api.get<{ data: Notification[]; total: number }>('/notifications', { params }),

  countUnread: () =>
    api.get<{ count: number }>('/notifications/unread-count'),

  markRead: (id: string) =>
    api.patch(`/notifications/${id}/read`),

  markAllRead: () =>
    api.post('/notifications/mark-all-read'),

  archive: (id: string) =>
    api.patch(`/notifications/${id}/archive`),

  unarchive: (id: string) =>
    api.patch(`/notifications/${id}/unarchive`),
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/api/notifications.ts
git commit -m "feat(api): add notifications API service with list, mark read, archive methods"
```

---

### Task 2: Notifications page

**Files:**
- Create: `apps/web/app/notifications/page.tsx`
- Create: `apps/web/components/notification-item.tsx`
- Create: `apps/web/components/notification-group.tsx`

- [ ] **Step 1: Create notifications page with filter tabs**

```tsx
// apps/web/app/notifications/page.tsx
'use client';

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread' | 'archived'>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    notificationsApi.list({ filter })
      .then((res) => setNotifications(res.data))
      .finally(() => setLoading(false));
  }, [filter]);

  // Group by date
  const grouped = groupByDate(notifications);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="text-sm text-primary-400 hover:text-primary-300">
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-surface-900/50 p-1">
        {(['all', 'unread', 'archived'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-surface-800 text-white' : 'text-surface-400 hover:text-surface-200'
            }`}
          >
            {f}
            {f === 'unread' && unreadCount > 0 && (
              <span className="ml-2 rounded-full bg-primary-600 px-1.5 py-0.5 text-[10px] text-white">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Empty states */}
      {!loading && notifications.length === 0 && (
        <EmptyState filter={filter} />
      )}

      {/* Grouped list */}
      {Object.entries(grouped).map(([date, items]) => (
        <NotificationGroup key={date} date={date} items={items} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Build NotificationGroup component**

```tsx
// notification-group.tsx
export function NotificationGroup({ date, items }: { date: string; items: Notification[] }) {
  return (
    <div className="mb-6">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-surface-500">
        {formatDateLabel(date)}
      </p>
      <div className="space-y-1">
        {items.map((item) => (
          <NotificationItem key={item.id} notification={item} onArchive={handleArchive} onMarkRead={handleMarkRead} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build NotificationItem with type icon and click navigation**

```tsx
// notification-item.tsx
const TYPE_ICONS: Record<NotificationType, React.ElementType> = {
  mention: AtSign,
  comment: MessageSquare,
  invitation: UserPlus,
  update: RefreshCw,
  board_shared: Share2,
};

export function NotificationItem({ notification, onArchive, onMarkRead }: Props) {
  const Icon = TYPE_ICONS[notification.type] || Bell;

  return (
    <Link
      href={notification.resourceUrl || '#'}
      onClick={() => !notification.read && onMarkRead(notification.id)}
      className={`flex items-start gap-4 rounded-xl p-4 transition-colors ${
        notification.read ? 'bg-surface-950' : 'bg-surface-900/80'
      } hover:bg-surface-800/50`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
        notification.read ? 'bg-surface-800' : 'bg-primary-600/20'
      }`}>
        <Icon size={16} className={notification.read ? 'text-surface-500' : 'text-primary-400'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${notification.read ? 'text-surface-400' : 'text-surface-200'}`}>
          {notification.title}
        </p>
        <p className="mt-0.5 text-xs text-surface-500 line-clamp-2">{notification.body}</p>
        <p className="mt-1 text-[10px] text-surface-600">{formatRelativeDate(notification.createdAt)}</p>
      </div>
      {!notification.read && (
        <span className="mt-1.5 flex h-2 w-2 shrink-0 rounded-full bg-primary-500" />
      )}
    </Link>
  );
}
```

Add `animate-fadeIn` to the notification item wrapper for entry animation.

- [ ] **Step 4: Empty state per filter tab**

```tsx
function EmptyState({ filter }: { filter: string }) {
  const configs = {
    all: { icon: BellOff, title: 'No notifications', desc: 'You\'re all caught up' },
    unread: { icon: CheckCheck, title: 'No unread notifications', desc: 'All caught up' },
    archived: { icon: Archive, title: 'No archived notifications', desc: 'Archived notifications appear here' },
  };
  const { icon: Icon, title, desc } = configs[filter as keyof typeof configs];

  return (
    <div className="flex flex-col items-center justify-center py-24">
      <Icon size={40} className="text-surface-600" />
      <h3 className="mt-4 text-lg font-semibold text-surface-300">{title}</h3>
      <p className="mt-1 text-sm text-surface-500">{desc}</p>
    </div>
  );
}
```

- [ ] **Step 5: Optimistic "Mark all read"**

```tsx
async function handleMarkAllRead() {
  const prev = notifications;
  setNotifications((n) => n.map((n) => ({ ...n, read: true })));
  try {
    await notificationsApi.markAllRead();
  } catch {
    setNotifications(prev);
    toast.error('Failed to mark all as read');
  }
}
```

- [ ] **Step 6: Undo toast on archive**

```tsx
async function handleArchive(item: Notification) {
  setNotifications((n) => n.filter((x) => x.id !== item.id));
  // Show undo toast
  toast.info('Notification archived', {
    action: { label: 'Undo', onClick: () => undoArchive(item) },
    duration: 5000,
  });
  try {
    await notificationsApi.archive(item.id);
  } catch {
    setNotifications((n) => [...n, item]);
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/notifications/ apps/web/components/notification-item.tsx apps/web/components/notification-group.tsx
git commit -m "feat(notifications): add notifications page with filter tabs, grouping, type icons, optimistic mark-all-read, undo archive"
```

---

### Task 3: Notification dropdown

**Files:**
- Create: `apps/web/components/notifications-dropdown.tsx`
- Modify: `apps/web/app/layout.tsx` (or sidebar if dropdown is triggered from there)

- [ ] **Step 1: Build dropdown with polling**

```tsx
// apps/web/components/notifications-dropdown.tsx
'use client';

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Poll every 15s
  useEffect(() => {
    function poll() {
      notificationsApi.list({ filter: 'unread', limit: 20 })
        .then((res) => setNotifications(res.data));
      notificationsApi.countUnread()
        .then((res) => setUnreadCount(res.count));
    }
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell button with unread badge */}
      <button onClick={() => setOpen(!open)} className="relative">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-surface-700 bg-surface-900 shadow-2xl z-50">
          <div className="flex items-center justify-between border-b border-surface-800 px-4 py-3">
            <span className="text-sm font-medium">Notifications</span>
            <Link href="/notifications" className="text-xs text-primary-400">View all</Link>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-xs text-surface-500">No new notifications</p>
            ) : (
              notifications.slice(0, 10).map((item) => (
                <DropdownNotificationItem key={item.id} item={item} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Pulse animation for unread badge**

Already using `animate-pulse` (Tailwind built-in). Ensure it pulses: if unread count changes, animation resets.

- [ ] **Step 3: Add dropdown to layout/sidebar**

In the sidebar or top nav, replace the static Bell icon with `<NotificationsDropdown />`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/notifications-dropdown.tsx
git commit -m "feat(notifications): add notification dropdown with 15s polling, unread badge, view all link"
```

---

### Task 4: Push notifications — backend

**Files:**
- Create: `apps/web/app/api/push/subscribe/route.ts`
- Create: `apps/web/app/api/push/unsubscribe/route.ts`

- [ ] **Step 1: VAPID key setup**

Generate VAPID keys (add to project .env or setup script):
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
```

- [ ] **Step 2: POST /push/subscribe endpoint**

```ts
// apps/web/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { subscription } = await req.json();
  // Validate subscription object (endpoint, keys)
  // Store in database associated with current user
  // Return 200
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: DELETE /push/unsubscribe endpoint**

```ts
// apps/web/app/api/push/unsubscribe/route.ts
export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json();
  // Remove subscription from database
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/push/
git commit -m "feat(push): add VAPID push subscribe/unsubscribe API endpoints"
```

---

### Task 5: Push notifications — frontend

**Files:**
- Create: `apps/web/public/sw.js`
- Create: `apps/web/hooks/use-push-notifications.ts`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Create Service Worker**

```js
// apps/web/public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'New notification', body: '' };

  const options = {
    body: data.body,
    icon: '/icon.png',
    badge: '/badge.png',
    data: { url: data.url },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.notification.data?.url) {
    clients.openWindow(event.notification.data.url);
  }
});
```

- [ ] **Step 2: Create usePushNotifications hook**

```ts
// apps/web/hooks/use-push-notifications.ts
export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  async function subscribe() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== 'granted') return;

    const registration = await navigator.serviceWorker.register('/sw.js');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });

    await fetch('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription }),
    });
  }

  async function unsubscribe() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await fetch('/api/push/unsubscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  }

  return { permission, subscribe, unsubscribe };
}
```

Include `urlBase64ToUint8Array` utility function.

- [ ] **Step 3: Wire into layout — subscribe on login, unsubscribe on logout**

In the root layout or auth context:

```tsx
const { subscribe, unsubscribe } = usePushNotifications();

useEffect(() => {
  if (isAuthenticated) {
    subscribe();
  } else {
    unsubscribe();
  }
}, [isAuthenticated]);
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/sw.js apps/web/hooks/use-push-notifications.ts
git commit -m "feat(push): add service worker, push notification hook, auto subscribe on login"
```
