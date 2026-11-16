# Dashboard events

The Events panel replaces only the dashboard calendar dropdown. Board calendars
and the separate calendar page are unchanged.

Events are personal, not workspace-shared. Users can create, edit and delete
their own events with a title, start time, optional end time, location and notes.
Inputs use the browser's local timezone and are saved as UTC timestamps. The
dashboard lists up to 100 upcoming or ongoing events, earliest first; the panel
initially shows five. This does not send invitations, reminders or email, and
does not synchronize with external calendars.

## API and privacy

`GET /api/v1/events`, `POST /api/v1/events`, `PUT /api/v1/events/:id` and
`DELETE /api/v1/events/:id` use the existing verified-user JWT guard. The owner
comes exclusively from the authenticated user, never the request body. Reads
and mutations filter by owner and exclude soft-deleted events. Unknown and
other users' event IDs both return 404. Deletion retains a recoverable row in
the database; there is no restore UI yet.

Titles are limited to 160 characters, locations to 200 and notes to 2000.
Timestamps must include a timezone. An end time must be after the start time;
the database also enforces this constraint.

## Running and deployment

Apply migration [0009_chief_living_tribunal.sql](../../packages/database/src/migrations/0009_chief_living_tribunal.sql)
and restart the API after building. Deploy the API alongside the frontend.
The local migration was applied to the loopback development database only.

After building the database package and API, run:

```sh
corepack pnpm --filter api test:events
corepack pnpm --filter @repo/database check-migrations
```

The event integration check uses a disposable PGlite database. It tests HTTP
validation and UUID parsing, owner-scoped CRUD, date order, ongoing/upcoming
selection, limits and soft deletion without sending mail or touching real data.
