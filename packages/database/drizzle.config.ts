import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(process.cwd(), "../../.env"),
});

export default defineConfig({
  dialect: "postgresql",

  schema: "./src/schema/*",

  out: "./src/migrations",

  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});