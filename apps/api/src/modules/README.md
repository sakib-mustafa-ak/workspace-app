# Workspace OS — Backend Modules

Each directory here is a bounded context that owns its own slice of the
business. Every module follows the same shape:

```
<feature>/
├── controllers/       Thin HTTP edges
├── services/          Business logic (use cases)
├── repositories/      Persistence only, no HTTP/business
├── dto/               Validation + transport shapes
├── entities/          Domain types (optional — colocate when small)
├── events/            Domain event publishers and handlers
├── policies/          Authorization decisions
├── interfaces/        Public contracts (token-based DI)
├── tests/             Module-scoped tests
├── <feature>.module.ts   Nest module composition root
└── index.ts              Public API for other modules
```

## Mounting a module

1. Implement the module under its own folder.
2. Add it to `imports` in `apps/api/src/app.module.ts`.
3. Expose a public symbol from `index.ts` only — never reach into
   internals from sibling modules.

## Cross-module communication

Other modules consume a feature through:

- A service token (preferred for synchronous flows), e.g.
  `AuthService` injected by interface name.
- A domain event (preferred for side effects fan-out), e.g.
  `WorkspaceCreated` published to the in-process event bus.

## Bounded contexts shipped initially

- `auth/`        — identity, sessions, refresh tokens
- `users/`       — profile, preferences
- `workspaces/`  — workspace, members, invitations, roles
- `boards/`      — board metadata + collaboration surface
- `canvas/`      — canvas state + objects (later)
- `realtime/`    — websocket gateway (later)
- `comments/`    — comments and threads (later)
- `notifications/` — in-app + email channels (later)
- `uploads/`     — file storage (later)
- `ai/`          — provider-abstracted AI assistant (later)

Later modules are created on-demand per the implementation playbook.
