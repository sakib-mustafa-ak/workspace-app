import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/*",
  out: "./src/migrations",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://workspace:workspace123@localhost:5432/workspace",
  },
});