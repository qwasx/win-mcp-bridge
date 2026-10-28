"""第 6 阶段：烘焙图样检视——从 src/gl/fxbake.ts 抽出着色器，在无头 Chromium 的 WebGL2 里逐格渲染成一张图（深底）。
用法: python3 tools/fxbakesheet.py out.png [起始模式=18] [结束模式=63]"""
import sys, re, json
from playwright.sync_api import sync_playwright

out = sys.argv[1]
m0 = int(sys.argv[2]) if len(sys.argv) > 2 else 18
m1 = int(sys.argv[3]) if len(sys.argv) > 3 else 63
src = open('src/gl/fxbake.ts', encoding='utf-8').read()
VS = re.search(r"const VS = `(.*?)`;", src, re.S).group(1)
FS = re.search(r"const FS = `(.*?)`;", src, re.S).group(1)
names = re.findall(r"uMode==(\d+)\)\{ // ([^\n]*)", src)
NAME = {int(a): b[:14] for a, b in names}
modes = list(range(m0, m1 + 1))
cols = 8
rows = (len(modes) + cols - 1) // cols
S = 160
html = """<html><body style="margin:0;background:#151a22"><canvas id=c></canvas><div id=log style="color:#f88"></div><script>
const VS = %s, FS = %s, modes = %s, NAME = %s, S = %d, cols = %d, rows = %d;
const cv = document.getElementById('c'); cv.width = cols * S; cv.height = rows * (S + 18);
const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: true });
const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { document.getElementById('log').textContent = gl.getShaderInfoLog(sh); throw new Error(gl.getShaderInfoLog(sh)); } return sh; };
const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
gl.bindVertexArray(gl.createVertexArray());
gl.clearColor(0.08, 0.1, 0.13, 1); gl.clear(gl.COLOR_BUFFER_BIT);
gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
const U = (n) => gl.getUniformLocation(pr, n);
modes.forEach((m, i) => { const cx = i %% cols, cy = Math.floor(i / cols);
  gl.viewport(cx * S, cv.height - (cy * (S + 18) + S), S, S);
  gl.uniform1i(U('uMode'), m); gl.uniform1f(U('uSeed'), [0.7, 1.9, 3.3][(m - 18 + 300) %% 3]); gl.uniform1f(U('uA'), 0); gl.uniform1f(U('uB'), 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3); });
window.__done = true;
</script></body></html>""" % (json.dumps(VS), json.dumps(FS), json.dumps(modes), json.dumps(NAME), S, cols, rows)
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'])
    p = b.new_page(viewport={'width': cols * S, 'height': rows * (S + 18)})
    errs = []
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.set_content(html)
    import time
    for _ in range(120):
        if p.evaluate("() => !!window.__done || !!document.getElementById('log').textContent"): break
        time.sleep(0.5)
    log = p.evaluate("() => document.getElementById('log').textContent")
    if log: print('SHADER ERROR\n' + log); sys.exit(1)
    p.screenshot(path=out)
    b.close()
# 标注
from PIL import Image, ImageDraw, ImageFont
im = Image.open(out).convert('RGB')
for i, m in enumerate(modes):   # 帧缓冲行序与贴图相反：逐格上下翻转，与游戏里看到的方向一致
    cx, cy = i % cols, i // cols; box = (cx * S, cy * (S + 18), cx * S + S, cy * (S + 18) + S)
    im.paste(im.crop(box).transpose(Image.FLIP_TOP_BOTTOM), box)
d = ImageDraw.Draw(im)
f = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc', 12)
for i, m in enumerate(modes):
    cx, cy = i % cols, i // cols
    d.text((cx * S + 4, cy * (S + 18) + S + 1), f'{m} {NAME.get(m, "")}', fill=(255, 210, 120), font=f)
im.save(out)
print('ok', out, errs)
