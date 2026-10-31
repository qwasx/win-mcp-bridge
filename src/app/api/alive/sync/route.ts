import { NextResponse } from "next/server";
import { deserialize, worldSummary } from "@/lib/alive";
import { WORLD_KEY, saveWorld } from "@/lib/world-store";
import type { SaveBlob } from "@/lib/alive";

export const dynamic = "force-dynamic";

/** 游戏客户端定期把活世界快照推上来（同源时才生效；失败静默） */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { day?: number; heroName?: string; blob?: SaveBlob };
    if (!body?.blob?.souls?.length) return NextResponse.json({ ok: false, reason: "bad blob" }, { status: 400 });
    const w = deserialize(body.blob);
    if (body.heroName) w.heroName = body.heroName;
    await saveWorld(w, "game");
    return NextResponse.json({ ok: true, day: Math.round(w.day), summary: worldSummary(w) });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: e instanceof Error ? e.message : "error" }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, key: WORLD_KEY, hint: "POST { day, heroName, blob } from the game to mirror its living world." });
}

export const runtime = "nodejs";
