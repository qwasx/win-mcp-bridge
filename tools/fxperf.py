"""第 6 阶段：特效压力测试——真游戏（Xvfb + SwiftShader WebGL），六只靶子，20 秒内轮番施放重特效法术，
采样帧率 / 渲染耗时 / 粒子数。改前改后各跑一遍对比（软件渲染，看相对值）。
用法: FANREN_PORT=4183 xvfb-run -a python3 tools/fxperf.py <输出json> [秒数=20]"""
import sys, os, time, json
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
SECS = float(sys.argv[2]) if len(sys.argv) > 2 else 20
PORT = os.environ.get('FANREN_PORT', '4183')
ROT = ['lieyan', 'huoya', 'bingpo', 'leihai', 'xuanbingyu', 'tianhuo', 'bixie', 'qianlan', 'huoqiufu', 'jinren', 'yimu', 'shihun', 'chunli', 'jiuyou', 'huangsha', 'shanhe']

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'])
    p = b.new_page(viewport={'width': 1280, 'height': 800})
    errs = []
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.goto(f'http://localhost:{PORT}/?auto=new', wait_until='load', timeout=180000)
    for _ in range(200):
        if p.evaluate("() => !!(window.__game && window.__game.renderer)"): break
        time.sleep(2)
    time.sleep(3)
    gl = p.evaluate("""() => { const g = window.__game; try { g.story.skipAll(); g.story.openT = -1; } catch (e) {} g.modal = null; g.emitModal(); g.revealAll = true; g.debugSeeAll = true;
        const q = g.findLand(251520, 143800); g.teleport(q.x, q.y); g.hero.realm = 5; g.hero.stage = 1; g.debugGive('art_qingzhu'); g.debugGive('mat_jinleizhu');
        try { g.setWeather('clear'); } catch (e) {} g.cam.zoom = g.cam.targetZoom = 0.9; g.showPerf = true;
        setInterval(() => { g.hero.hp = 1; g.hero.mp = 1; g.modal = null; for (const e of g.combat.enemies) if (e.__tgt) { e.skT = 99; e.atk = 0; e.cast = null; e.x = e.__x; e.y = e.__y; e.hp = e.maxHp; } }, 100);
        return !!g.renderer.stage; }""")
    time.sleep(6)
    p.evaluate("""() => { const g = window.__game, c = g.combat, P = g.player;
        for (let i = 0; i < 6; i++) { g.debugSpawn(['wolf'], 5, 1, 300); const e = c.enemies[c.enemies.length - 1]; e.__tgt = 1; e.maxHp = e.hp = 1e9; e.x = e.__x = P.x + 380 + (i % 3) * 70; e.y = e.__y = P.y + (Math.floor(i / 3) - 0.5) * 140; }
        c.lock = c.enemies[0]; c.manual = true; }""")
    time.sleep(2)
    samples = []
    t0 = time.time(); k = 0; nextCast = 0
    while time.time() - t0 < SECS:
        now = time.time() - t0
        if now >= nextCast:
            sid = ROT[k % len(ROT)]; k += 1; nextCast = now + 0.6
            p.evaluate(f"() => window.__game.debugCast('{sid}')")
            if k % 8 == 0: p.evaluate("() => { const P = window.__game.player; if (window.__bigfx) window.__bigfx('tribulation', { x: P.x + 420, y: P.y }); }")
        s = p.evaluate("() => { const g = window.__game, pf = g.perf, F = g.renderer.fx; return { fps: pf.fps, ren: pf.renMs, upd: pf.updMs, worst: pf.worstMs, parts: F ? F.count : -1, vfx: g.combat.vfx.length, projs: g.combat.projs.length, fields: g.combat.fields.length }; }")
        samples.append(s)
        time.sleep(0.25)
    b.close()
fps = [s['fps'] for s in samples if s['fps']]
ren = [s['ren'] for s in samples if s['ren']]
res = {'gl': gl, 'casts': k, 'n': len(samples), 'fps_avg': sum(fps) / len(fps), 'fps_min': min(fps), 'ren_avg_ms': sum(ren) / len(ren), 'ren_max_ms': max(ren),
       'worst_ms': max(s['worst'] or 0 for s in samples), 'parts_max': max(s['parts'] for s in samples), 'errors': errs[:10]}
json.dump({'summary': res, 'samples': samples}, open(OUT, 'w'), ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False))
