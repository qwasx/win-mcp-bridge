"""第 2 阶段检查图：冲关面板、筑基小玩法、结丹品阶、结婴心魔与外敌、突破场面（按时间）、总结、闭关被打断。
需要 vite preview：FANREN_PORT=4181 python3 tools/ascendshot.py <输出目录> [段落...]"""
import sys, os, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
ONLY = set(sys.argv[2:])
os.makedirs(OUT, exist_ok=True)
W, H = 1280, 800
PORT = os.environ.get('FANREN_PORT', '4181')


def main():
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                               args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
                                     '--disable-accelerated-2d-canvas', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        p = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        errs = []
        p.on('pageerror', lambda e: errs.append(str(e)))
        p.on('console', lambda m: errs.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
        p.goto(f"http://localhost:{PORT}/?auto=new", wait_until='load', timeout=120000)
        for _ in range(180):
            if p.evaluate("() => !!(window.__game && window.__game.renderer)"): break
            time.sleep(2)
        time.sleep(3)
        ev = p.evaluate
        ev("""() => { const g = window.__game; try { g.story.skipAll(); g.story.openT = -1; } catch (e) {}
            g.modal = null; g.emitModal(); g.clock = 240 * 0.42; try { g.setWeather('clear'); } catch (e) {} g.renderer.setQuality(2); }""")
        print('webgl stage:', ev("() => !!window.__game.renderer.stage"), flush=True)
        time.sleep(2)

        KEEP = ['01_冲关面板', '05_筑基_引灵冲脉', '06_筑基场面_b', '06_筑基场面_d', '07_筑基_变强总结', '12_结丹_总结', '14_结婴_心魔幻境', '16_结婴_外敌', '19_结婴场面_e', '25_闭关被打断_弹窗']

        def shot(name):
            if not any(name.startswith(k) for k in KEEP): return
            p.screenshot(path=f'{OUT}/{name}.png'); print('shot', name, flush=True)

        def until(js, tmo=150, step=0.15):
            t0 = time.time()
            while time.time() - t0 < tmo:
                if ev(js): return True
                time.sleep(step)
            print('timeout', js, flush=True); return False

        def pick(i=0):
            ev(f"""() => {{ const g = window.__game; const m = g.modal; if (!m || m.kind !== 'dialog') return;
                const os = m.node.options.filter(o => !o.disabled); const o = os[Math.min({i}, os.length - 1)]; const before = g.modal;
                const r = o.act(); if (r) g.openDialog(r); else if (g.modal === before) g.closeModal(); }}""")
            time.sleep(0.4)

        def dialog_done():  # 打字机效果：等字打完
            time.sleep(2.2)

        def spot():
            ev("""() => { const g = window.__game; const L = window.__fanrenLoc('huangfeng'); const S = 300;
                for (const [dx, dy] of [[8, 6], [-8, 6], [10, -4], [0, 12], [12, 8], [-10, -6]]) { const q = g.findLand(L.x * S + dx * 300, L.y * S + dy * 300);
                  let ok = true; for (let a = 0; a < 10; a++) for (const r of [300, 700]) if (g.terrain.walkFactor(q.x + Math.cos(a) * r, q.y + Math.sin(a) * r) < 0.9) ok = false;
                  if (ok) { g.teleport(q.x, q.y); return; } }
                const q = g.findLand(L.x * S + 2400, L.y * S + 1800); g.teleport(q.x, q.y); }""")
            time.sleep(3)

        def cine_shots(prefix, marks):
            """按冲关场面的时间点连拍：marks = [(秒, 名字)]"""
            for t, nm in marks:
                until(f"() => {{ const g = window.__game, r = g.ascend.run; if (!r || r.phase !== 'cine' || r.ct >= {t}) {{ g.paused = true; return true; }} return false; }}", 60, 0.03)
                time.sleep(0.5); shot(f'{prefix}_{nm}')
                ev("() => { window.__game.paused = false; }")

        def zoom(z):
            ev(f"() => {{ const g = window.__game; g.cam.zoom = g.cam.targetZoom = {z}; }}")

        spot()
        zoom(0.9)
        time.sleep(2)
        on = lambda k: not ONLY or k in ONLY

        # ---------------- 1. 冲关面板与准备清单（结婴，凑了四项）
        if on('panel'):
            ev("() => { const g = window.__game; g.ascend.debugPeak(3, 4, 2); g.onPanel('char', true); }")
            time.sleep(2.5); shot('01_冲关面板_准备清单_结婴')
            ev("() => { const g = window.__game; g.onPanel(''); g.ascend.debugPeak(1, 1, 1); g.onPanel('char', true); }")
            time.sleep(2.5); shot('02_冲关面板_准备清单_筑基_只凑一项')
            ev("() => { document.querySelector('.close-btn')?.click(); }"); time.sleep(0.6)

        # ---------------- 2. 筑基：引灵冲脉 → 场面 → 总结
        if on('zhuji'):
            ev("() => { const g = window.__game; g.ascend.debugPeak(1, 4, 2, 'win'); g.breakthrough(2); }")
            time.sleep(0.6); dialog_done(); shot('03_筑基_关卡说明')
            pick(0)
            until("() => window.__game.ascend.run && window.__game.ascend.run.phase === 'pulse'")
            # 前三脉按准、第四脉按偏
            for i in range(3):
                ev("() => { const m = window.__game.ascend.run.mg; m.ang = m.zone + (Math.random() - 0.5) * 0.05; window.__game.ascend.press(); }"); time.sleep(0.5)
            ev("() => { const m = window.__game.ascend.run.mg; m.ang = m.zone + 2.2; window.__game.ascend.press(); }"); time.sleep(0.15)
            shot('04_筑基_引灵冲脉_反噬')
            time.sleep(0.8)
            ev("() => { const m = window.__game.ascend.run.mg; m.ang = m.zone - m.zw * 0.35; }"); time.sleep(0.05)
            shot('05_筑基_引灵冲脉_光点将入金区')
            for i in range(10):
                if not ev("() => !!(window.__game.ascend.run && window.__game.ascend.run.phase === 'pulse')"): break
                ev("() => { const m = window.__game.ascend.run.mg; m.ang = m.zone; window.__game.ascend.press(); }"); time.sleep(0.35)
            until("() => window.__game.ascend.run && window.__game.ascend.run.phase === 'cine'")
            cine_shots('06_筑基场面', [(0.5, 'a_漩涡卷起_题字'), (1.1, 'b_水墨镜头'), (2.2, 'c_镜头拉远'), (2.9, 'd_大字_筑基'), (3.45, 'e_水墨_灵气倒灌'), (4.4, 'f_破境'), (6.3, 'g_第三个水墨镜头')])
            until("() => !!window.__game.ascend.summary", 60)
            time.sleep(0.8); shot('07_筑基_变强总结')
            ev("() => window.__game.ascend.closeSummary()"); time.sleep(0.5)

        # ---------------- 3. 结丹：心魔 → 凝丹三转 → 金丹品阶
        if on('jiedan'):
            ev("() => { const g = window.__game; g.hero.kills = 60; g.ascend.debugPeak(2, 5, 3, 'win'); g.breakthrough(3); }")
            time.sleep(0.5); dialog_done(); shot('08_结丹_心魔劫')
            for _ in range(7):
                t = ev("() => { const m = window.__game.modal; return m && m.kind === 'dialog' ? m.node.title : ''; }")
                if '结丹 ·' in (t or ''): break
                pick(1 if '心魔劫 ·' in (t or '') and '尽' not in t else 0)
            dialog_done(); shot('09_结丹_凝丹第一转_火候选择')
            pick(1); dialog_done(); shot('10_结丹_凝丹第二转')
            pick(0); pick(1); dialog_done()
            pick(0)
            until("() => window.__game.ascend.run && window.__game.ascend.run.phase === 'cine'")
            cine_shots('11_结丹场面', [(2.9, 'a_大字_金丹_品阶')])
            until("() => !!window.__game.ascend.summary", 60)
            time.sleep(0.8); shot('12_结丹_总结_金丹品阶')
            ev("() => window.__game.ascend.closeSummary()"); time.sleep(0.5)

        # ---------------- 4. 结婴：心魔五重 → 碎丹 → 外敌一波波 → 元婴显化
        if on('yuanying'):
            spot()
            ev("() => { const g = window.__game; g.hero.kills = 220; g.ascend.debugPeak(3, 5, 2, 'win'); g.breakthrough(2); }")
            time.sleep(0.5); dialog_done(); shot('13_结婴_心魔幻境_1')
            pick(0); time.sleep(0.3); pick(0); dialog_done(); shot('14_结婴_心魔幻境_2')
            for _ in range(12):
                t = ev("() => { const m = window.__game.modal; return m && m.kind === 'dialog' ? m.node.title : ''; }")
                if '碎丹成婴' in (t or ''): break
                pick(0)
            dialog_done(); shot('15_结婴_碎丹成婴_说明')
            pick(0)
            until("() => window.__game.ascend.run && window.__game.ascend.run.phase === 'waves'")
            ev("() => { const g = window.__game; window.__keep = setInterval(() => { const r = g.ascend.run; if (!r) return; g.hero.hp = Math.max(g.hero.hp, 0.7); g.player.x = r.x; g.player.y = r.y; }, 100); }")
            zoom(0.55)
            until("() => { const w = window.__game.ascend.run?.wv; return w && w.wave >= 1; }", 120)
            time.sleep(3.5); shot('16_结婴_外敌第一波_护法迎敌')
            ev("() => { const w = window.__game.ascend.run.wv; w.prog = 0.63; }")
            until("() => { const w = window.__game.ascend.run?.wv; return w && w.wave >= 3; }", 60)
            time.sleep(3.0); shot('17_结婴_第三波_老魔夺婴')
            ev("() => window.__game.onOpenMap && window.__game.onOpenMap()"); time.sleep(2.5); shot('18_大地图_远处看得见的灵气漩涡')
            ev("() => { const g = window.__game; g.onOpenMap(); }"); time.sleep(0.8)
            ev("() => { const w = window.__game.ascend.run.wv; w.prog = 0.995; }")
            until("() => window.__game.ascend.run && window.__game.ascend.run.phase === 'cine'", 60)
            cine_shots('19_结婴场面', [(0.6, 'a_漩涡'), (1.15, 'b_水墨'), (2.9, 'c_大字_元婴'), (3.45, 'd_水墨'), (5.7, 'e_元婴显化_题字'), (6.35, 'f_水墨_元婴'), (7.4, 'g_元婴')])
            until("() => !!window.__game.ascend.summary", 60)
            time.sleep(0.8); shot('20_结婴_变强总结')
            ev("() => { window.__game.ascend.closeSummary(); clearInterval(window.__keep); }"); time.sleep(1.5)
            zoom(1.0); time.sleep(2); shot('21_元婴之后_身带灵光')
            ev("() => { const g = window.__game; g.ascend.toggleOut(); }"); time.sleep(0.5)
            ev("() => { const g = window.__game; g.input.keys.add('d'); }"); time.sleep(2.0)
            ev("() => { const g = window.__game; g.input.keys.clear(); }"); zoom(0.6); time.sleep(1.5); shot('22_元婴出窍_肉身留在原地')
            ev("() => { const g = window.__game; g.ascend.toggleOut(); }"); time.sleep(1)

        # ---------------- 5. 闭关被打断
        if on('seclude'):
            ev("""() => { const g = window.__game; g.ascend.debugPeak(2, 0, 0); const h = g.hero; h.stage = 1; h.exp = 0; h.asc.xinde = 5000;
                h.asc.nextIntr = Math.floor(g.day) + 140; h.asc.intrN = 0; g.events.nextStart = () => null; g.onPanel('seclude', true); }""")
            time.sleep(2); shot('23_闭关面板_心得')
            p.locator('.sec-opt', has_text='一年').first.click(); time.sleep(1.5)
            shot('24_闭关被打断_出关报告')
            ev("() => { document.querySelector('.cult-panel .ink-btn.jade')?.click(); }"); time.sleep(1)
            until("() => window.__game.modal && window.__game.modal.kind === 'dialog'", 20)
            dialog_done(); shot('25_闭关被打断_弹窗')
            pick(0); time.sleep(3); zoom(0.75); time.sleep(1.5); shot('26_出关迎敌')
            # 第二次：宗门召集
            ev("""() => { const g = window.__game; for (const e of g.combat.enemies) e.dead = true; g.modal = null; g.emitModal(); const h = g.hero; h.asc.nextIntr = Math.floor(g.day) + 100; h.asc.intrN = 2;
                g.ws.sect = g.ws.sect || { id: 'huangfeng', rank: 1, contrib: 100, joined: g.day, lastPay: g.day, tasks: [], done: 0 }; g.seclude(360); }""")
            until("() => window.__game.modal && window.__game.modal.kind === 'dialog'", 20)
            dialog_done(); shot('27_闭关被打断_宗门召集')
            pick(0)

        print('errors:', errs[:12], flush=True)
        b.close()


if __name__ == '__main__':
    main()
