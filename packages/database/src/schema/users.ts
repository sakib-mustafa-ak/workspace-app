import {
  pgTable,
  uuid,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid().defaultRandom().primaryKey(),

  fullName: text().notNull(),

  email: text().notNull().unique(),

  password: text().notNull(),

  avatar: text(),

  createdAt: timestamp().defaultNow().notNull(),

  updatedAt: timestamp().defaultNow().notNull(),
});