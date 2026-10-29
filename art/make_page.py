#!/usr/bin/env python3
"""Build art/index.html — a self-contained preview page with the SVG inlined.

Run after gen_pelican.py:  python3 art/make_page.py
"""

from pathlib import Path

HERE = Path(__file__).parent
svg = (HERE / "pelican-bicycle.svg").read_text(encoding="utf-8")
# drop the XML preamble-ish whitespace and make the svg responsive inside the page
svg = svg.replace('width="800" height="540"', 'width="100%" height="auto"', 1)

HTML = f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>鹈鹕骑自行车 · Pelican on a Bicycle</title>
<style>
  :root {{
    --ink: #3d3529;
    --muted: #8a7a63;
    --card: #fffdf8;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 20px;
    font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
                 system-ui, -apple-system, "Segoe UI", sans-serif;
    color: var(--ink);
    background:
      radial-gradient(1200px 600px at 15% -10%, #FFF6E6 0%, transparent 60%),
      radial-gradient(900px 500px at 100% 110%, #FFE9CE 0%, transparent 55%),
      #FAF0DF;
  }}
  .wrap {{ width: min(920px, 100%); }}
  header {{ text-align: center; margin-bottom: 18px; }}
  h1 {{
    margin: 0 0 6px;
    font-size: clamp(22px, 3.4vw, 32px);
    letter-spacing: .02em;
  }}
  h1 span {{ color: var(--muted); font-weight: 400; font-size: .55em; margin-left: .5em; }}
  p.sub {{ margin: 0; color: var(--muted); font-size: 14px; }}
  .card {{
    background: var(--card);
    border-radius: 26px;
    padding: 14px;
    box-shadow:
      0 1px 0 rgba(255,255,255,.8) inset,
      0 18px 50px -18px rgba(120, 88, 40, .35),
      0 2px 8px rgba(120, 88, 40, .06);
    overflow: hidden;
  }}
  .stage {{ border-radius: 16px; overflow: hidden; display: block; background: #FDEBD2; }}
  .stage svg {{ display: block; }}
  .bar {{
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 12px 8px 4px; flex-wrap: wrap;
  }}
  .hint {{ color: var(--muted); font-size: 13px; }}
  .hint code {{ background: #F4EADA; padding: 1px 6px; border-radius: 6px; font-size: 12px; }}
  .actions {{ display: flex; gap: 8px; }}
  button, a.btn {{
    font: inherit; font-size: 13px;
    text-decoration: none; display: inline-block; line-height: normal;
    padding: 8px 16px;
    border-radius: 999px;
    border: 1px solid #E4D6BF;
    background: #FFF8EC;
    color: var(--ink);
    cursor: pointer;
    transition: transform .12s ease, background .2s ease, box-shadow .2s ease;
  }}
  button:hover, a.btn:hover {{ background: #FFF1DC; box-shadow: 0 4px 12px rgba(150,110,50,.12); }}
  button:active, a.btn:active {{ transform: translateY(1px); }}
  button[aria-pressed="true"] {{ background: #F6E3C6; border-color: #DFC79C; }}
  .paused * {{ animation-play-state: paused !important; }}
  @media (prefers-color-scheme: dark) {{
    :root {{ --ink: #3d3529; }}
  }}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>鹈鹕骑自行车<span>Pelican on a Bicycle</span></h1>
    <p class="sub">纯 SVG 手绘 · 轮子会转、腿会蹬、围巾会飘</p>
  </header>

  <div class="card">
    <div class="stage" id="stage">
{svg}
    </div>
    <div class="bar">
      <div class="hint">单文件 <code>pelican-bicycle.svg</code>，约 21 KB，无限循环</div>
      <div class="actions">
        <button id="toggle" aria-pressed="false">暂停</button>
        <a class="btn" href="pelican-bicycle.svg" download="pelican-bicycle.svg">下载 SVG</a>
      </div>
    </div>
  </div>
</div>

<script>
  const stage = document.getElementById('stage');
  const svg = stage.querySelector('svg');
  const btn = document.getElementById('toggle');
  let paused = false;

  btn.addEventListener('click', () => {{
    paused = !paused;
    stage.classList.toggle('paused', paused);
    try {{ paused ? svg.pauseAnimations() : svg.unpauseAnimations(); }} catch (e) {{}}
    btn.textContent = paused ? '继续' : '暂停';
    btn.setAttribute('aria-pressed', String(paused));
  }});
</script>
</body>
</html>
"""

(HERE / "index.html").write_text(HTML, encoding="utf-8")
print(f"wrote {HERE / 'index.html'} ({len(HTML)} bytes)")
