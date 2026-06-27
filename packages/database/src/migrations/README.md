# Migrations

Generated SQL files live here. To create a new migration:

> Note: Phase 0 of this repo has a placeholder migration. They will be
> regenerated once the live DB is brought up — until then the only
> authority is the schema source.

```bash
# gen a new SQL file (auto-numbers, prefixes with timestamp)
pnpm --filter @repo/database generate
```

Or:

```bash
cd packages/database
DATABASE_URL='postgresql://workspace:workspace123@localhost:5433/workspace' \
  ./node_modules/.bin/drizzle-kit generate --name=<feature>
```

To apply migrations against a live DB:

```bash
DATABASE_URL='postgresql://workspace:workspace123@localhost:5433/workspace' \
  ./node_modules/.bin/drizzle-kit migrate
```

## Rules

1. **Never edit a file that has already been applied.** A new change
   requires a new file.
2. **Always review** the generated SQL — Drizzle's best-effort output
   is checked-in for visibility, never silently auto-shipped.
3. **Backward compatibility** for non-trivial changes (column type,
   constraint, FK) should land as two migrations: add-immutable +
   migrate-old-data + drop-old. Use ADRs for anything surprising.
