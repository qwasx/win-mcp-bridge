import { NextResponse } from "next/server";
import { worldView } from "@/lib/world-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const view = await worldView();
  return NextResponse.json({ ok: true, ...view });
}

export const runtime = "nodejs";
