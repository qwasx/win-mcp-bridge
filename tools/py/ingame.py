# 真游戏截图（发型/动作检查）：城中路人群像、主角跑、主角御剑。FANREN_PORT=端口 OUT=目录
import os, time
from playwright.sync_api import sync_playwright
OUT = os.environ['OUT']; W, H = 1280, 760
def main():
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
            args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas', '--no-sandbox'])
        p = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2)
        errs = []
        p.on('pageerror', lambda e: errs.append(str(e)))
        p.goto(f"http://localhost:{os.environ['FANREN_PORT']}/?auto=new", wait_until='load', timeout=120000)
        for _ in range(180):
            if p.evaluate("() => !!(window.__game && window.__game.renderer)"): break
            time.sleep(2)
        time.sleep(3)
        p.evaluate("""() => { const g = window.__game; try { g.story.skipAll(); g.story.openT = -1; } catch (e) {} g.modal = null; g.emitModal(); }""")
        time.sleep(3)
        def zoom(z):
            p.evaluate(f"""() => {{ const g = window.__game; g.__z = {z}; if (!g.__zk) {{ g.__zk = 1; const k = () => {{ g.cam.zoom = g.cam.targetZoom = g.__z; g.cam.x = g.player.x; g.cam.y = g.player.y; requestAnimationFrame(k); }}; k(); }} }}""")
        def hud(show):
            p.evaluate(f"""() => document.querySelectorAll('.hud, .hint, [class*="Hud"], [class*="hud"], .toast, [class*="toast"]').forEach(e => e.style.visibility = {'"visible"' if show else '"hidden"'})""")
        def keys(*ks, run=False):
            p.evaluate(f"""() => {{ const g = window.__game; g.input.keys.clear(); {''.join(f"g.input.keys.add('{k}');" for k in ks)} g.input.run = {'true' if run else 'false'}; }}""")
        p.evaluate("() => { const g = window.__game; try { g.setWeather('clear'); } catch (e) {} g.clock = 240 * 0.42; }")
        p.evaluate("() => { const g = window.__game; const t = window.__fanrenLoc('jiayuan'); g.teleport(t.x * 300, t.y * 300 + 60); }")
        time.sleep(8)
        keys('s'); time.sleep(1.6); keys(); time.sleep(1)
        hud(False); zoom(1.5); time.sleep(5)
        p.screenshot(path=f'{OUT}/07_游戏实测_城中路人.png')
        zoom(2.2); keys('d', 's', run=True); time.sleep(1.4)
        p.screenshot(path=f'{OUT}/08_游戏实测_主角奔跑.png', clip={'x': W/2-260, 'y': H/2-300, 'width': 520, 'height': 440})
        keys(); time.sleep(0.6)
        p.evaluate("() => window.__game.toggleFly()"); time.sleep(1.5)
        keys('a'); time.sleep(1.8)
        p.screenshot(path=f'{OUT}/09_游戏实测_主角御剑.png', clip={'x': W/2-280, 'y': H/2-380, 'width': 560, 'height': 500})
        keys()
        print('errors:', errs[:5])
        b.close()
main()
