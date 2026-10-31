import { integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// 活世界 · 世界后台（玩家不在的时候，这个世界也在过自己的日子）
export const worlds = pgTable(
  "worlds",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    day: integer("day").notNull().default(0),
    heroName: text("hero_name").notNull().default("韩立"),
    population: integer("population").notNull().default(0),
    blob: jsonb("blob").notNull(),
    source: text("source").notNull().default("server"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("worlds_key_idx").on(t.key)],
);

export const chronicle = pgTable("chronicle", {
  id: serial("id").primaryKey(),
  worldKey: text("world_key").notNull(),
  day: integer("day").notNull(),
  kind: text("kind").notNull(),
  text: text("text").notNull(),
  place: text("place"),
  weight: integer("weight").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WorldRow = typeof worlds.$inferSelect;
export type ChronicleRow = typeof chronicle.$inferSelect;
