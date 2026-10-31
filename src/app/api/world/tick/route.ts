import { NextResponse } from "next/server";
import { advance } from "@/lib/world-store";

export const dynamic = "force-dynamic";

/** 推进世界若干日（玩家不在，世界照常过日子） */
export async function POST(req: Request) {
  let days = 30;
  try {
    const body = (await req.json()) as { days?: number };
    if (typeof body?.days === "number") days = body.days;
  } catch {
    // 无 body 时按默认 30 日
  }
  const res = await advance(days);
  return NextResponse.json({ ok: true, days, ...res });
}

export const runtime = "nodejs";
