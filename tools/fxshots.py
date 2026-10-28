"""第 6 阶段特效检查图：真游戏里连放法术，每门 3 帧；宗门色系；大场面。
用法: FANREN_PORT=4183 python3 tools/fxshots.py <输出目录> [spells|sects|big|all]
需要先 vite preview 在该端口。"""
import sys, os, time, json
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
MODE = sys.argv[2] if len(sys.argv) > 2 else 'all'
os.makedirs(OUT, exist_ok=True)
W, H = 1280, 800
PORT = os.environ.get('FANREN_PORT', '4183')

SPELLS = [
    ('huodan', '火弹术'), ('huoya', '火鸦阵'), ('bingzhui', '冰锥术'), ('bingpo', '冰魄神针'),
    ('shuidan', '水箭术'), ('fengren', '风刃术'), ('feishi', '飞石术'), ('tengfu', '藤缚术'),
    ('yimu', '乙木剑气'), ('yujian', '御剑术'), ('qingyuanmang', '青元剑芒'), ('jingshen', '惊神刺'),
    ('shihun', '噬魂鬼爪'), ('yinhun', '阴魂丝'), ('leiguang', '雷光指'), ('huoqiufu', '火球符·连发'),
    ('qijin', '气劲掌'), ('qingyang', '青阳魔火'), ('hanpo', '寒魄冰龙'), ('benlei', '奔雷剑'),
    ('lieyan', '烈焰风暴'), ('xuanbingyu', '玄冰天狱'), ('ziluo', '紫罗极火'), ('jiuyou', '九幽冥火'),
]
BIG = [('bixie', '辟邪神雷', [0.25, 0.6, 1.0]), ('qianlan', '乾蓝冰焰', [0.2, 0.45, 0.8]), ('beiji', '北极元光', [0.2, 0.45, 0.8]),
       ('faxiang', '法相金身（元婴法相）', [0.5, 1.2, 2.4]), ('dageng', '大庚剑阵', [1.2, 3.0, 5.5]), ('leihai', '万雷天牢', [0.4, 0.9, 1.5])]
# 宗门：名字、本门五行（与 schools.ts 一致）
SECTS = [('huangfeng', '黄枫谷', 'sword'), ('yanyue', '掩月宗', 'ice'), ('guiling', '鬼灵门', 'ghost'), ('xinggong', '星宫', 'gold'),
         ('hehuan', '合欢宗', 'poison'), ('tianque', '天阙堡', 'earth'), ('lingshou', '灵兽山', 'poison'), ('luoyun', '落云宗', 'poison'),
         ('yuling', '御灵宗', 'ghost'), ('qingxu', '清虚门', 'thunder'), ('huadao', '化刀坞', 'metal'), ('tiansha', '天煞宗', 'blood'),
         ('jiyin', '极阴岛', 'ice'), ('qianzhu', '千竹教', 'thunder'), ('miaoyin', '妙音门', 'wind'), ('huayi', '化意门', 'water')]
EL_PROJ = {'phys': 'rock', 'fire': 'fireball', 'ice': 'icicle', 'water': 'water', 'thunder': 'lightning', 'poison': 'vine', 'blood': 'blood', 'ghost': 'ghost',
           'wind': 'wind', 'earth': 'rock', 'sword': 'sword', 'gold': 'goldthunder', 'metal': 'needle'}
EL_COL = {'phys': '230,200,160', 'fire': '255,120,40', 'ice': '150,215,255', 'water': '90,170,255', 'thunder': '170,190,255', 'poison': '140,220,70',
          'blood': '230,40,60', 'ghost': '150,230,200', 'wind': '190,255,225', 'earth': '210,170,110', 'sword': '210,255,240', 'gold': '255,215,90', 'metal': '220,225,235'}
EL_BOOM = {'phys': 'rock', 'fire': 'flame', 'ice': 'frost', 'water': 'water', 'thunder': 'lightning', 'poison': 'poison', 'blood': 'blood', 'ghost': 'ghost',
           'wind': 'wind', 'earth': 'rock', 'sword': 'sword', 'gold': 'goldthunder', 'metal': 'sword'}


def main():
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                               args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
                                     '--disable-accelerated-2d-canvas', '--no-sandbox'])
        p = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        errs = []
        p.on('pageerror', lambda e: errs.append(str(e)))
        p.on('console', lambda m: errs.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
        p.goto(f"http://localhost:{PORT}/?auto=new", wait_until='load', timeout=180000)
        for _ in range(200):
            if p.evaluate("() => !!(window.__game && window.__game.renderer)"): break
            time.sleep(2)
        time.sleep(3)
        p.evaluate("""() => { const g = window.__game; try { g.story.skipAll(); g.story.openT = -1; } catch (e) {}
            g.modal = null; g.emitModal(); g.revealAll = true; g.debugSeeAll = true; }""")
        spot = p.evaluate("""() => { const g = window.__game; const q = g.findLand(251520, 143800); g.teleport(q.x, q.y); return [q.x, q.y]; }""")   # 前人法术连拍用的空地
        print('spot', spot, flush=True)
        p.evaluate("""() => { const g = window.__game; try { g.setWeather('clear'); } catch (e) {} g.clock = 240 * 0.45; g.renderer.setQuality && g.renderer.setQuality(2);
            g.hero.realm = 5; g.hero.stage = 1; g.debugGive('art_qingzhu'); g.debugGive('mat_jinleizhu');
            setInterval(() => { g.hero.hp = 1; g.hero.mp = 1; g.clock = 240 * 0.45; g.modal = null; for (const e of g.combat.enemies) if (e.__tgt) { e.skT = 99; e.atk = 0; e.windup = 0; e.cast = null; e.aggro = false; if (e.__x !== undefined) { e.x = e.__x; e.y = e.__y; } } }, 100);
            g.__z = 1.15; const k = () => { g.cam.zoom = g.cam.targetZoom = g.__z; g.cam.x = g.player.x + 190; g.cam.y = g.player.y - 60; requestAnimationFrame(k); }; k(); }""")
        p.evaluate("""() => document.querySelectorAll('.hud, .hint, [class*="Hud"], [class*="hud"], .toast, [class*="toast"]').forEach(e => e.style.visibility = 'hidden')""")
        time.sleep(6)

        def clean():
            p.evaluate("""() => { const c = window.__game.combat; c.vfx.length = 0; c.projs.length = 0; c.fields.length = 0; c.strikes.length = 0; c.acts.list.length = 0; c.fxq.length = 0; c.sparks.length = 0; }""")

        def targets(n=3, dist=420):
            p.evaluate(f"""() => {{ const g = window.__game, c = g.combat, P = g.player;
                c.enemies = c.enemies.filter(e => !e.dead && e.__tgt);
                while (c.enemies.length < {n}) {{ g.debugSpawn(['wolf'], 5, 1, 300); const e = c.enemies[c.enemies.length - 1]; e.__tgt = 1; }}
                c.enemies.forEach((e, i) => {{ e.x = e.__x = P.x + {dist} + (i - 1) * 60; e.y = e.__y = P.y + (i - 1) * 90; e.maxHp = e.hp = 1e9; e.aggro = false; e.st = {{}}; e.mvx = e.mvy = 0; e.speed = 0; }});
                c.lock = c.enemies[0]; c.manual = true; P.st.yaw = Math.PI / 2; }}""")

        def clip(dx=150, dy=-80, w=900, h=520):
            return {'x': W / 2 - w / 2 + dx - 160, 'y': H / 2 - h / 2 + dy + 70, 'width': w, 'height': h}

        def shoot_seq(name, cast_js, delays, cl):
            # 固定步长（每帧 1/60 秒游戏时间），按游戏时间取帧；拍照瞬间把步长调到几乎为零，画面冻结
            p.evaluate("() => { window.__game.debugFixedDt = 1 / 60; }")
            t0 = p.evaluate("() => window.__game.time")
            p.evaluate(cast_js)
            for i, d in enumerate(delays):
                for _ in range(4000):
                    if p.evaluate("() => window.__game.time") - t0 >= d: break
                    time.sleep(0.01)
                p.evaluate("() => { window.__game.debugFixedDt = 1e-5; }")
                time.sleep(0.15)
                p.screenshot(path=f'{OUT}/{name}_{i}.png', clip=cl)
                p.evaluate("() => { window.__game.debugFixedDt = 1 / 60; }")
            p.evaluate("() => { window.__game.debugFixedDt = 0; }")
            print('seq', name, flush=True)

        if MODE in ('spells', 'all', 'sb'):
            only = [x for x in os.environ.get('FX_ONLY', '').split(',') if x]
            for sid, nm in SPELLS:
                if only and sid not in only: continue
                clean(); targets(); time.sleep(0.8)
                shoot_seq(f'sp_{sid}', f"() => window.__game.debugCast('{sid}')", [0.12, 0.35, 0.7], clip())
                time.sleep(1.4)
        if MODE in ('big', 'all', 'bs'):
            for sid, nm, ds in BIG:
                clean(); targets(5, 460); time.sleep(0.8)
                p.evaluate("() => { window.__game.__z = 0.7; }"); time.sleep(0.5)
                shoot_seq(f'big_{sid}', f"() => window.__game.debugCast('{sid}')", ds, clip(150, -120, 1100, 680))
                time.sleep(2.5)
                p.evaluate("() => { window.__game.__z = 1.15; }")
            # 通用大型特效（供突破 / 天劫调用；改前版本没有此接口则跳过）
            for kind, nm in (('tribulation', '天劫雷'), ('vortex', '灵气漩涡'), ('pillar', '光柱'), ('inkshock', '水墨冲击波')):
                has = p.evaluate("() => typeof window.__bigfx === 'function'")
                if not has: break
                clean(); p.evaluate("() => { window.__game.__z = 0.7; }"); time.sleep(0.6)
                shoot_seq(f'big_{kind}', f"() => {{ const P = window.__game.player; window.__bigfx('{kind}', {{ x: P.x + 260, y: P.y + 40 }}); }}", [0.3, 0.9, 1.8], clip(150, -140, 1100, 680))
                time.sleep(2.5)
            p.evaluate("() => { window.__game.__z = 1.15; }")
        if MODE in ('sects', 'all', 'bs', 'sb'):
            clean(); p.evaluate("() => { const c = window.__game.combat; c.enemies.forEach(e => e.dead = true); c.enemies = []; }")
            for sid, nm, el in SECTS:
                clean(); time.sleep(0.4)
                js = f"""() => {{ const g = window.__game, c = g.combat, P = g.player; const sx = P.x - 120, sy = P.y - 60;
                    for (let i = 0; i < 4; i++) {{ const a = -0.25 + i * 0.17, sp = 520;
                      c.projs.push({{ fac: 'e', x: sx + i * 40, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 2, fx: '{EL_PROJ[el]}', color: '{EL_COL[el]}', dmg: 0, realm: 1, stCh: 0, pierce: true, homing: false, hit: new Set(), r: 1, trail: [], sect: '{sid}', size: 1 }}); }}
                    const bx = P.x + 560, by = P.y + 30;
                    c.vfx.push({{ kind: 'ring', x: bx, y: by, r: 130, t: 0, dur: 0.6, color: '{EL_COL[el]}', fx: '{EL_BOOM[el]}', sect: '{sid}' }});
                    c.vfx.push({{ kind: 'flash', x: bx, y: by - 30, r: 100, t: 0, dur: 0.5, color: '{EL_COL[el]}', fx: '{EL_BOOM[el]}', seed: 1, sect: '{sid}' }}); }}"""
                shoot_seq(f'sect_{sid}', js, [0.45], clip(150, -60, 1000, 420))
                time.sleep(1.0)
        with open(f'{OUT}/errors.json', 'w') as f: json.dump(errs[:60], f, ensure_ascii=False, indent=1)
        print('errors', len(errs), errs[:5])
        b.close()


if __name__ == '__main__':
    main()
