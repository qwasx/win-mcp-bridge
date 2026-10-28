"""第 4 阶段（s4-content）检查图：各地掉落、新出手方式、功法 / 法宝面板。
需要 vite preview 在 FANREN_PORT（默认 4182）。用法: python3 tools/shots-canon.py <输出目录> [part]"""
import sys, os, time, json
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
PART = sys.argv[2] if len(sys.argv) > 2 else 'all'
os.makedirs(OUT, exist_ok=True)
W, H = 1280, 800
PORT = os.environ.get('FANREN_PORT', '4182')


def open_game(pw, mp):
    b = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                           args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
                                 '--disable-accelerated-2d-canvas', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    p = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
    errs = []
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.goto(f"http://localhost:{PORT}/?auto=new&map={mp}", wait_until='load', timeout=180000)
    for _ in range(200):
        if p.evaluate("() => !!(window.__game && window.__game.renderer)"): break
        time.sleep(2)
    time.sleep(3)
    p.evaluate("""() => { const g = window.__game; try { g.story.skipAll(); g.story.openT = -1; } catch (e) {}
        g.modal = null; g.emitModal(); g.hero.realm = 3; g.hero.stage = 1; g.updateUI && g.updateUI(true);
        try { g.setWeather('clear'); } catch (e) {} g.clock = 240 * 0.42; }""")
    time.sleep(2)
    return b, p, errs


def shot(p, name, clip=None):
    p.screenshot(path=f'{OUT}/{name}.png', clip=clip)
    print('shot', name, flush=True)


def goto(p, loc, dx=0, dy=40):
    return p.evaluate(f"""() => {{ const g = window.__game; const L = window.__fanrenLoc('{loc}'); if (!L) return null;
        const q = g.findLand ? g.findLand(L.x * 300 + {dx} * 300, L.y * 300 + {dy} * 300) : {{ x: L.x * 300, y: L.y * 300 }};
        g.teleport(q.x, q.y); g.cam.x = q.x; g.cam.y = q.y; return L.name; }}""")


OVERLAY = """(title, lines) => { let d = document.getElementById('__lootov'); if (!d) { d = document.createElement('div'); d.id = '__lootov'; document.body.appendChild(d); }
  d.style.cssText = 'position:fixed;right:16px;top:70px;width:420px;max-height:640px;overflow:hidden;background:rgba(246,238,220,0.96);border:2px solid #8a6a30;border-radius:8px;padding:12px 14px;font:15px/1.55 serif;color:#3a2a18;z-index:99999;box-shadow:0 4px 18px rgba(0,0,0,.35)';
  d.innerHTML = '<div style="font-size:19px;font-weight:bold;margin-bottom:6px">' + title + '</div>' + lines.map(l => '<div>' + l + '</div>').join(''); }"""


def loot_round(p, name, loc, enemy, n=10, realm=3):
    nm = goto(p, loc)
    time.sleep(4)
    res = p.evaluate(f"""() => {{ const g = window.__game, c = g.combat; c.loot = []; c.enemies = [];
        const before = []; const out = [];
        for (let round = 0; round < 6; round++) {{
          g.debugSpawn(Array({n}).fill('{enemy}'), {realm}, 2, 260);
          for (const e of c.enemies) if (!e.dead) {{ e.aggro = true; c.hitEnemy(e, 1e9, {{ realm: 9, stCh: 0 }}, g.player.x, g.player.y); }}
        }}
        const T = {{ 0: '#7a7a7a', 1: '#5b8a5b', 2: '#3f78a8', 3: '#8a4fb0', 4: '#c08a2a', 5: '#c0392b' }};
        const seen = {{}};
        for (const l of c.loot) {{ if (l.id === 'mat_lingshi' || l.id.startsWith('mat_yaodan')) continue; seen[l.id] = (seen[l.id] || 0) + 1; }}
        const d = (window.__itemDef || ((id) => null));
        return {{ ids: Object.keys(seen), n: Object.values(seen).reduce((a, b) => a + b, 0), school: c.enemies.map(e => e.school).filter(Boolean).slice(0, 3) }}; }}""")
    names = p.evaluate("""(ids) => ids.map(id => { const it = window.__itemDef(id); return [it.name, it.tier, it.type, it.desc.slice(0, 26)]; })""", res['ids'])
    col = ['#7a7a7a', '#5b8a5b', '#3f78a8', '#8a4fb0', '#c08a2a', '#c0392b', '#e0a800']
    lines = [f'<b style="color:{col[t]}">{n}</b> <small style="color:#7a6a50">{"玉简" if ty == "scroll" else "法器"} · {ds}…</small>' for n, t, ty, ds in names[:22]]
    sect = p.evaluate("() => { const g = window.__game; return window.__sectAt ? window.__sectAt(g.player.x, g.player.y) : ''; }")
    p.evaluate(OVERLAY, [f'{nm}一带 · 斩杀{n * 6}名修士的掉落（共 {res["n"]} 件）', lines])
    time.sleep(1.5)
    shot(p, name)
    p.evaluate("() => { const d = document.getElementById('__lootov'); if (d) d.remove(); window.__game.combat.loot = []; window.__game.combat.enemies = []; }")
    print(name, nm, res['school'], len(res['ids']), flush=True)


def panel(p, name, tab=None):
    p.evaluate("() => window.__game.onPanel('gongfa', true)")
    time.sleep(1.5)
    if tab:
        p.evaluate(f"""() => {{ for (const b of document.querySelectorAll('.tabs button')) if (b.textContent.includes('{tab}')) b.click(); }}""")
        time.sleep(1.2)
    shot(p, name)
    p.evaluate("() => window.__game.onPanel('', true)")
    time.sleep(0.6)


def kinds_battle(p):
    goto(p, 'qingniu', 9, 3)
    time.sleep(4)
    p.evaluate("() => { const g = window.__game; g.cam.zoom = g.cam.targetZoom = 1.15; }")
    ids = p.evaluate("""() => { const K = ['gourd','umbrella','fan','beads','cover','pagoda','seal','lamp','shuttle','whip','disk','puppet']; const o = {};
        for (const k of K) { const it = window.__itemList.find(i => i.art && i.art.kind === k && i.tier >= 2 && i.tier <= 3 && i.id.startsWith('gen_tn')) || window.__itemList.find(i => i.art && i.art.kind === k); o[k] = [it.id, it.name]; } return o; }""")
    names = {'gourd': '葫芦收摄', 'umbrella': '伞挡', 'fan': '扇风', 'beads': '连珠', 'cover': '罩子困人', 'pagoda': '塔镇', 'seal': '印压', 'lamp': '灯照魂', 'shuttle': '梭遁', 'whip': '鞭', 'disk': '阵盘', 'puppet': '傀儡'}
    frames = {'gourd': [0.5, 1.3, 2.0], 'umbrella': [0.6, 2.0, 3.25], 'fan': [0.15, 0.3, 0.5], 'beads': [0.25, 0.6, 1.0], 'cover': [0.5, 1.8, 3.5],
              'pagoda': [0.35, 0.75, 2.2], 'seal': [0.35, 0.72, 0.85], 'lamp': [0.6, 1.6, 2.8], 'shuttle': [0.06, 0.15, 0.3], 'whip': [0.12, 0.38, 0.62],
              'disk': [0.5, 1.5, 3.0], 'puppet': [0.8, 2.5, 4.5]}
    i = 0
    for k, (iid, nm) in ids.items():
        i += 1
        p.evaluate(f"""() => {{ const g = window.__game, c = g.combat; c.enemies = []; c.loot = []; c.acts.list = []; c.shield = null;
            g.debugSpawn(['wolf','wolf','redwolf','wolf','boar'], 2, 3, 300);
            for (const e of c.enemies) {{ e.maxHp = e.hp = e.maxHp * 40; e.aggro = false; e.skT = 99; e.x += 160; }}
            g.debugGive('{iid}', 1); g.hero.mp = 1; g.hero.hp = 1; c.cds.clear(); }}""")
        time.sleep(0.8)
        p.evaluate(f"() => {{ window.__game.combat.castArtifact('{iid}'); window.__t0 = performance.now(); }}")
        t0 = time.time()
        for fi, ft in enumerate(frames[k]):
            dt = ft * 3.2 - (time.time() - t0)   # 无头软件渲染约 0.3 倍速
            if dt > 0: time.sleep(dt)
            p.evaluate(OVERLAY.replace('right:16px;top:70px;width:420px', 'left:16px;top:16px;width:300px'), [f'{names[k]} · {nm}', [f'第 {fi + 1} 帧']])
            shot(p, f'20_{i:02d}_{names[k]}_{fi + 1}')
        p.evaluate("() => { const d = document.getElementById('__lootov'); if (d) d.remove(); }")
        time.sleep(1.5)


def main():
    with sync_playwright() as pw:
        if PART in ('all', 'tiannan'):
            b, p, errs = open_game(pw, 'tiannan')
            loot_round(p, '10_天南_黄枫谷地界', 'huangfeng', 'zhujixiu')
            loot_round(p, '11_天南_鬼灵门地界', 'guiling', 'moxiu')
            loot_round(p, '12_天南_天阙堡地界', 'tianque', 'zhujixiu')
            loot_round(p, '13_天南_百巧院地界', 'baiqiao', 'zhujixiu')
            goto(p, 'huangfeng'); time.sleep(3)
            panel(p, '14_此地出产_黄枫谷', '此地出产')
            goto(p, 'guiling'); time.sleep(3)
            panel(p, '15_此地出产_鬼灵门', '此地出产')
            # 功法 / 法宝面板：给几门功法与法宝
            p.evaluate("""() => { const g = window.__game, h = g.hero; h.realm = 3; h.gfKnown = ['changchun', 'jiuyanggong', 'qingyuan', 'suonv']; h.gongfa = 'jiuyanggong'; h.gfAux = ['tongpi', 'lianqijie'];
                if (!h.arts.some(a => a.id === 'ranxue')) h.arts.push({ id: 'ranxue', xp: 0 });
                for (const id of window.__itemList.filter(i => i.art && i.art.kind === 'fan' && i.art.element === 'fire').slice(0, 1).map(i => i.id)) g.debugGive(id, 1);
                for (const id of ['art_hf_huangfeng', 'art_zz_yanyue', 'art_ls_lingshoudai', 'art_qx_leiyinyin', 'art_bq_mujia']) g.debugGive(id, 1); g.updateUI(true); }""")
            time.sleep(1)
            panel(p, '30_功法面板_主修辅修秘术')
            panel(p, '31_功法面板_套路搭配', '套路')
            panel(p, '32_功法面板_随身法宝', '随身法宝')
            if PART == 'all' or True:
                kinds_battle(p)
            print('errors', errs[:5])
            b.close()
        if PART in ('all', 'luanxing'):
            b, p, errs = open_game(pw, 'luanxing')
            loot_round(p, '16_乱星海_天星城一带', 'tianxing', 'zhujixiu')
            loot_round(p, '17_乱星海_极阴岛一带', 'jiyin', 'moxiu')
            goto(p, 'tianxing'); time.sleep(3)
            panel(p, '18_此地出产_星宫', '此地出产')
            print('errors', errs[:5]); b.close()
        if PART in ('all', 'dajin'):
            b, p, errs = open_game(pw, 'dajin')
            loot_round(p, '19_大晋_天魔宗一带', 'tianmo', 'moxiu')
            loot_round(p, '19b_大晋_太一门一带', 'taiyi', 'zhujixiu')
            goto(p, 'taiyi'); time.sleep(3)
            panel(p, '19c_此地出产_太一门', '此地出产')
            print('errors', errs[:5]); b.close()


main()
