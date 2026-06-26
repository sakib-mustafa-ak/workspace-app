import "dotenv/config";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://workspace:workspace123@localhost:5432/workspace";

const sql = postgres(connectionString, {
  max: 1,
});

const db = drizzle(sql);

await migrate(db, {
  migrationsFolder: "./src/migrations",
});

console.log("✅ Database migrated");

process.exit(0);