# 改前 / 改后动作对照：胶片条 PNG + 并排 GIF
# 用法: python3 -I compare.py <beforeDir> <afterDir> <outPrefix> <标题> [列=1] [步长=2]
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
bd, ad, out, title = sys.argv[1:5]
col = int(sys.argv[5]) if len(sys.argv) > 5 else 1
step = int(sys.argv[6]) if len(sys.argv) > 6 else 2
font = None
for f in ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc', '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc']:
    if os.path.exists(f): font = ImageFont.truetype(f, 22); break
if font is None:
    import subprocess
    p = subprocess.run(['fc-match', '-f', '%{file}', 'sans:lang=zh'], capture_output=True, text=True).stdout
    font = ImageFont.truetype(p, 22) if p else ImageFont.load_default()
B = sorted(glob.glob(bd + '/f*.png')); A = sorted(glob.glob(ad + '/f*.png'))
im0 = Image.open(B[0]); W, H = im0.size; cw = W // 6
# 胶片条：上改前、下改后，某一列（人物+朝向）的连续帧
idx = list(range(0, len(B), step))
strip = Image.new('RGB', (cw * len(idx) + 90, H * 2 + 40), '#e9dfc6')
d = ImageDraw.Draw(strip)
d.text((8, 6), title, fill='#3a2e22', font=font)
for r, (lst, lab) in enumerate([(B, '改前'), (A, '改后')]):
    d.text((8, 40 + H * r + H // 2), lab, fill='#3a2e22', font=font)
    for i, k in enumerate(idx):
        fr = Image.open(lst[k]).crop((cw * col, 0, cw * (col + 1), H))
        strip.paste(fr, (90 + cw * i, 40 + H * r))
        d.line([(90 + cw * i, 40 + H * r), (90 + cw * i, 40 + H * (r + 1))], fill='#cbbd9c')
strip.save(out + '_胶片.png')
# GIF：上改前、下改后（整行六个人）
frames = []
for b, a in zip(B, A):
    f = Image.new('RGB', (W, H * 2 + 30), '#e9dfc6')
    f.paste(Image.open(b).convert('RGB'), (0, 30)); f.paste(Image.open(a).convert('RGB'), (0, 30 + H))
    dd = ImageDraw.Draw(f); dd.text((6, 2), title + '   上：改前   下：改后', fill='#3a2e22', font=font)
    frames.append(f.quantize(colors=200))
frames[0].save(out + '.gif', save_all=True, append_images=frames[1:], duration=50, loop=0)
print('ok', out)
