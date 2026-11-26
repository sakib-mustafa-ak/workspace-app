import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { CREATED_AT, PRIMARY_ID, UPDATED_AT } from "../common.js";
import { workspaces } from "../workspaces/workspace.schema.js";
import { users } from "../users/user.schema.js";
import { tasks } from "../tasks/task.schema.js";

export const workspacePlugins = pgTable(
  "workspace_plugins",
  {
    id: PRIMARY_ID(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    key: text("key").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    connectedBy: uuid("connected_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    // Authenticated ciphertext only. Never select this column into API responses.
    credentials: text("credentials"),
    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
  },
  (t) => ({
    workspaceKey: uniqueIndex("workspace_plugins_workspace_key").on(
      t.workspaceId,
      t.key,
    ),
  }),
);

export const pluginOauthStates = pgTable(
  "plugin_oauth_states",
  {
    hash: text("hash").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    verifier: text("verifier").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (t) => ({ expiry: index("plugin_oauth_states_expiry").on(t.expiresAt) }),
);

export const taskTimeEntries = pgTable(
  "task_time_entries",
  {
    id: PRIMARY_ID(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
  },
  (t) => ({
    task: index("task_time_entries_task").on(t.taskId),
    running: uniqueIndex("task_time_entries_one_running")
      .on(t.workspaceId, t.userId)
      .where(sql`${t.endedAt} IS NULL`),
    duration: check(
      "task_time_entries_valid_duration",
      sql`${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.startedAt}`,
    ),
  }),
);

export const taskVotes = pgTable(
  "task_votes",
  {
    id: PRIMARY_ID(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: CREATED_AT(),
  },
  (t) => ({
    taskUser: uniqueIndex("task_votes_task_user").on(t.taskId, t.userId),
  }),
);
