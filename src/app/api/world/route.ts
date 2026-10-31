import { ensureWorld, worldAction } from '@/lib/world-store';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return Response.json(await ensureWorld(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { console.error('world read', error); return Response.json({ error: '世界存档暂时无法读取，请稍后重试。' }, { status: 500 }); }
}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    return Response.json(await worldAction(body), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '操作失败';
    const clientError = /无效|未知|不足|已经|没有|不支持|须为|请提供|结束/.test(message);
    return Response.json({ error: message }, { status: clientError ? 400 : 500 });
  }
}
