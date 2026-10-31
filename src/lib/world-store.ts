import { db } from '@/db';
import { worlds } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createLiving, act, validateAction, type LivingState } from '@/world/living';

const WORLD_ID = 'living-world-demo';
export async function ensureWorld() {
  await db.insert(worlds).values({ id: WORLD_ID, state: createLiving() }).onConflictDoNothing();
  const [row] = await db.select().from(worlds).where(eq(worlds.id, WORLD_ID));
  if (!row) throw new Error('世界存档初始化失败');
  return row;
}
export async function worldAction(body: unknown) {
  const action = validateAction(body);
  return db.transaction(async tx => {
    const [row] = await tx.select().from(worlds).where(eq(worlds.id, WORLD_ID)).for('update');
    if (!row) throw new Error('世界还未初始化，请刷新页面。');
    const result = act(row.state, action);
    const [updated] = await tx.update(worlds).set({ state: result.state as LivingState, version: sql`${worlds.version} + 1`, updatedAt: new Date() }).where(eq(worlds.id, WORLD_ID)).returning();
    return { ...result, version: updated.version, updatedAt: updated.updatedAt };
  });
}
