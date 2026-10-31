// 活世界 · 服务端世界仓库（同一份引擎，跑在服务器上）
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chronicle, worlds } from "@/db/schema";
import {
  createServerWorld, deserialize, serialize, tickDays, worldSummary, soulView,
  type SaveBlob, type World,
} from "@/lib/alive";

export const WORLD_KEY = "tiannan";

export async function loadWorld(): Promise<World> {
  const rows = await db.select().from(worlds).where(eq(worlds.key, WORLD_KEY)).limit(1);
  if (rows.length) {
    try {
      const w = deserialize(rows[0].blob as SaveBlob);
      if (w && w.souls && Object.keys(w.souls).length > 4) return w;
    } catch {
      // 快照坏了就重建
    }
  }
  const fresh = createServerWorld({ seed: 20260214, heroName: rows[0]?.heroName ?? "韩立" });
  tickDays(fresh, 240);
  await saveWorld(fresh, "server");
  return fresh;
}

export async function saveWorld(w: World, source = "server"): Promise<void> {
  const blob = serialize(w);
  const summary = worldSummary(w);
  const row = {
    key: WORLD_KEY,
    day: Math.round(w.day),
    heroName: w.heroName,
    population: summary.population,
    blob: blob as unknown as Record<string, unknown>,
    source,
    updatedAt: new Date(),
  };
  await db
    .insert(worlds)
    .values(row)
    .onConflictDoUpdate({
      target: worlds.key,
      set: { day: row.day, heroName: row.heroName, population: row.population, blob: row.blob, source: row.source, updatedAt: row.updatedAt },
    });

  // 大事记落库（只记有分量的，避免爆表）
  const recent = w.chron.filter((c) => c.weight >= 2).slice(-160);
  await db.delete(chronicle).where(eq(chronicle.worldKey, WORLD_KEY));
  if (recent.length) {
    await db.insert(chronicle).values(
      recent.map((c) => ({ worldKey: WORLD_KEY, day: c.day, kind: c.kind, text: c.text, place: c.place ?? null, weight: c.weight })),
    );
  }
}

export async function chronicleFeed(limit = 80) {
  return db.select().from(chronicle).where(eq(chronicle.worldKey, WORLD_KEY)).orderBy(desc(chronicle.day), desc(chronicle.id)).limit(limit);
}

export async function advance(days: number): Promise<{ added: { day: number; kind: string; text: string }[]; day: number }> {
  const w = await loadWorld();
  const added = tickDays(w, Math.max(1, Math.min(days, 400)));
  await saveWorld(w, "server");
  return { added: added.filter((a) => a.weight >= 1).map((a) => ({ day: a.day, kind: a.kind, text: a.text })), day: Math.round(w.day) };
}

/** 面板要的一份完整视图 */
export async function worldView() {
  const w = await loadWorld();
  const souls = Object.keys(w.souls).map((k) => w.souls[k]).filter((s) => s.alive && s.id !== "__hero__");
  souls.sort((a, b) => b.realm * 100 + b.stage - (a.realm * 100 + a.stage));
  return {
    summary: worldSummary(w),
    day: Math.round(w.day),
    hero: w.hero,
    contacts: w.contacts.filter((c) => !c.handled),
    chron: w.chron.slice(-90).reverse(),
    rumors: w.rumors.slice(-40).reverse(),
    npcs: souls.slice(0, 120).map((s) => {
      const v = soulView(w, s.id)!;
      return {
        id: v.id, name: v.name, realm: v.realmName, sect: v.sectName ?? (v.faction === "mortal" ? "凡人" : "散修"),
        at: v.homeName, agenda: v.agendaText, bag: v.bag.length, arts: v.arts.length, kin: v.kinNames.length,
        favor: Math.round(v.favor ?? 0),
        grudge: Math.round(Math.max(0, ...v.grudgeNames.filter((g) => g.id === "__hero__").map((g) => g.heat))),
        bagWorth: Math.round(v.bagWorth),
        pers: v.persName,
      };
    }),
  };
}
