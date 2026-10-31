import { pgTable, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import type { LivingState } from '@/world/living';

export const worlds = pgTable('living_worlds', {
  id: text('id').primaryKey(),
  state: jsonb('state').$type<LivingState>().notNull(),
  version: integer('version').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
