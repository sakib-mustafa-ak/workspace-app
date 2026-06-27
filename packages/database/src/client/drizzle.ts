/**
 * Re-export barrel for Drizzle operators and helpers.
 *
 * Why this exists:
 *  pnpm + NodeNext + symlinked workspace packages make TypeScript see
 *  two distinct private declarations of the same `.d.ts` file when it
 *  is resolved once via the symlinked package path (`@repo/database`)
 *  and once via the app's hoisted `node_modules/.pnpm/.../drizzle-orm`
 *  path. Functions and types are nominally distinct even when identical,
 *  so `eq(...)` returned by `drizzle-orm` linked from the package cannot
 *  be passed where the API app's `drizzle-orm` expects one.
 *
 *  By having every consumer in `apps/api` import operators through
 *  `@repo/database` we keep a single Drizzle resolution active in the
 *  TypeScript program, eliminating the mismatch. This also honours
 *  the blueprint rule: dependencies on persistence primitives flow
 *  through repositories; business modules never reach Drizzle directly.
 *
 *  Add new operators here rather than letting them leak across
 *  barrel boundaries; the package owns the persistence surface.
 */
export {
  sql,
  eq,
  ne,
  and,
  or,
  not,
  gt,
  gte,
  lt,
  lte,
  isNull,
  isNotNull,
  like,
  ilike,
  inArray,
  notInArray,
  exists,
  notExists,
  asc,
  desc,
  between,
} from 'drizzle-orm';

export type { SQL, SQLWrapper } from 'drizzle-orm';
