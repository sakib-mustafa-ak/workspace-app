import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://workspace:workspace123@localhost:5432/workspace";

const client = postgres(connectionString);

export const db = drizzle(client);