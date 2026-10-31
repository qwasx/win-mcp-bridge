#!/usr/bin/env python3
"""第三十三步：音效与乐器采样构建（CC0 素材 → 单声道 mp3 → src/assets/sfx/ + src/world/sfxData.ts）

素材来源（全部 CC0 1.0 公有领域，克隆到仓库外 /home/user/assets-src/）：
  - Kenney 音效（impact / interface / rpg / sci-fi 等）与 OpenGameArt CC0 包：github.com/Mcamento8/open-game-sfx-index
  - 二胡采样：github.com/sfzinstruments/aliexpress-erhu
  - 竹笛采样：github.com/NeoSoundFonts/SP-Bamboo-Flute
用法：python3 tools/sfxbuild.py   （需要 ffmpeg：FF 环境变量或 /tmp/ff/...）
"""
import os, sys, subprocess, struct, wave, math, random, base64
FF = os.environ.get('FF', '/tmp/ff/node_modules/@ffmpeg-installer/linux-x64/ffmpeg')
SRC = '/home/user/assets-src'
A = SRC + '/open-game-sfx-index/audio'
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'sfx')
TS = os.path.join(os.path.dirname(__file__), '..', 'src', 'world', 'sfxData.ts')
SR = 32000
random.seed(7)

def imp(n): return f'{A}/impact-sounds/{n}.ogg'
def oga(n): return f'{A}/oga-rpg-pack/RPG Sound Pack/{n}' if os.path.exists(f'{A}/oga-rpg-pack/RPG Sound Pack/{n}') else None
def find(name):
    for root, _, files in os.walk(A):
        if name in files: return os.path.join(root, name)
    raise SystemExit('missing ' + name)

# 名称 → (源文件, 最长秒数, 音量增益 dB)
SFX = {
  # 拳脚 / 法术命中
  'hit1': ('hit03.mp3.flac', 0.7, 0), 'hit2': ('hit09.mp3.flac', 0.6, 0), 'hit3': ('hit12.mp3.flac', 0.6, 0),
  'hit4': ('hit17.mp3.flac', 0.7, 0), 'hit5': ('hit25.mp3.flac', 0.6, 0), 'hit6': ('hit32.mp3.flac', 0.6, 0),
  'punch1': ('impactPunch_heavy_000.ogg', 0.6, 0), 'punch2': ('impactPunch_heavy_001.ogg', 0.6, 0), 'punchm': ('impactPunch_medium_000.ogg', 0.5, 0),
  'thud': ('impactSoft_heavy_000.ogg', 0.6, 0),
  # 金铁 / 剑
  'metal1': ('impactMetal_light_000.ogg', 0.8, 0), 'metal2': ('impactMetal_light_002.ogg', 0.8, 0), 'metal3': ('impactMetal_medium_000.ogg', 0.9, 0),
  'metalh': ('impactMetal_heavy_000.ogg', 1.0, 0), 'plate': ('impactPlate_heavy_000.ogg', 1.0, 0),
  # 冰 / 灵光破碎
  'glass1': ('impactGlass_heavy_000.ogg', 1.0, 0), 'glass2': ('impactGlass_heavy_002.ogg', 1.0, 0),
  'ice1': ('impactGlass_light_000.ogg', 0.6, 0), 'ice2': ('impactGlass_light_001.ogg', 0.6, 0), 'icem': ('impactGlass_medium_000.ogg', 0.8, 0),
  # 钟 / 木 / 石
  'bell1': ('impactBell_heavy_000.ogg', 2.0, 0), 'bell2': ('impactBell_heavy_002.ogg', 2.0, 0),
  'woodh': ('impactWood_heavy_000.ogg', 0.6, 0), 'woodl': ('impactWood_light_000.ogg', 0.4, 0), 'plank': ('impactPlank_medium_000.ogg', 0.6, 0),
  'rock1': ('impactMining_000.ogg', 0.6, 0), 'rock2': ('impactMining_002.ogg', 0.6, 0),
  # 爆裂 / 灵光罩 / 毒
  'boom1': ('lowFrequency_explosion_000.ogg', 1.8, 0), 'boom2': ('lowFrequency_explosion_001.ogg', 1.8, 0),
  'crunch1': ('explosionCrunch_000.ogg', 1.2, 0), 'crunch2': ('explosionCrunch_002.ogg', 1.2, 0),
  'field1': ('forceField_000.ogg', 1.0, 0), 'field2': ('forceField_002.ogg', 1.0, 0),
  'slime': ('slime_000.ogg', 0.7, 0), 'goo': ('slime1.wav', 0.4, 0),
  # 挥击 / 出鞘 / 法术
  'swish1': ('swish_2.wav', 0.4, 0), 'swish2': ('swish_3.wav', 0.6, 0), 'swish3': ('swish_4.wav', 0.4, 0), 'bow': ('Bow.wav', 0.6, 0),
  'swing1': ('swing.wav', 0.3, 0), 'swing2': ('swing2.wav', 0.2, 0), 'swing3': ('swing3.wav', 0.2, 0),
  'unsheathe1': ('sword-unsheathe.wav', 0.6, 0), 'unsheathe2': ('sword-unsheathe3.wav', 0.6, 0),
  'magic': ('magic1.wav', 0.9, 0), 'spell': ('spell.wav', 2.4, 0),
  # 妖兽
  'roar1': ('giant1.wav', 0.8, 0), 'roar2': ('giant3.wav', 0.8, 0), 'roar3': ('giant5.wav', 0.8, 0), 'ogre': ('ogre2.wav', 0.7, 0),
  'beast1': ('mnstr2.wav', 0.6, 0), 'beast2': ('mnstr5.wav', 0.95, 0), 'beast3': ('mnstr9.wav', 0.8, 0), 'wolf': ('wolfman.wav', 0.5, 0),
  'small1': ('mnstr12.wav', 0.5, 0), 'small2': ('mnstr15.wav', 0.4, 0),
  'shade1': ('shade3.wav', 0.7, 0), 'shade2': ('shade7.wav', 1.3, 0), 'shade3': ('shade11.wav', 1.2, 0),
  'bite1': ('bite-small.wav', 0.4, 0), 'bite2': ('bite-small3.wav', 0.5, 0),
  # 脚步
  'st_grass1': ('footstep_grass_000.ogg', 0.4, 0), 'st_grass2': ('footstep_grass_001.ogg', 0.4, 0), 'st_grass3': ('footstep_grass_002.ogg', 0.4, 0),
  'st_snow1': ('footstep_snow_000.ogg', 0.45, 0), 'st_snow2': ('footstep_snow_001.ogg', 0.45, 0),
  'st_stone1': ('footstep_concrete_000.ogg', 0.35, 0), 'st_stone2': ('footstep_concrete_001.ogg', 0.35, 0),
  'st_wood1': ('footstep_wood_000.ogg', 0.35, 0), 'st_wood2': ('footstep_wood_001.ogg', 0.35, 0),
  'st_leaf': ('leaves01.ogg', 0.4, 0), 'st_gravel': ('gravel.ogg', 0.35, 0),
  # 界面 / 物件
  'ui_click': ('click_002.ogg', 0.2, 0), 'ui_select': ('select_001.ogg', 0.3, 0), 'ui_confirm': ('confirmation_002.ogg', 0.6, 0), 'ui_error': ('error_004.ogg', 0.5, 0),
  'ui_open': ('bookOpen.ogg', 0.6, 0), 'ui_close': ('bookClose.ogg', 0.5, 0), 'ui_flip': ('bookFlip1.ogg', 0.5, 0),
  'ui_coin': ('handleCoins.ogg', 0.8, 0), 'ui_cloth': ('cloth1.ogg', 0.5, 0), 'ui_latch': ('metalLatch.ogg', 0.4, 0), 'ui_drop': ('drop_002.ogg', 0.4, 0),
  'bubble': ('bubble.wav', 0.5, 0), 'bottle': ('bottle.wav', 0.5, 0), 'beads': ('beads.wav', 0.5, 0), 'coin': ('coin.wav', 0.6, 0),
  'chop': ('chop.ogg', 0.5, 0), 'knife': ('knifeSlice.ogg', 0.5, 0),
}

def run(args):
    r = subprocess.run(args, capture_output=True)
    if r.returncode: print(r.stderr.decode()[-800:]); raise SystemExit('ffmpeg failed')

def build_sfx(name, src, maxd):
    path = find(src)
    af = (f'silenceremove=start_periods=1:start_threshold=-48dB,'
          f'atrim=0:{maxd},afade=t=out:st={max(0.0, maxd - min(0.12, maxd * 0.3))}:d={min(0.12, maxd * 0.3)},'
          f'areverse,silenceremove=start_periods=1:start_threshold=-60dB,areverse,'
          f'loudnorm=I=-15:TP=-1.0:LRA=11')
    run([FF, '-y', '-v', 'error', '-i', path, '-af', af, '-ac', '1', '-ar', str(SR), '-c:a', 'libmp3lame', '-q:a', '6', f'{OUT}/{name}.mp3'])

# ---------------- 乐器：持续音延长（交叉淡化循环），统一时长，便于一次性播放
def read_mono(path):
    raw = subprocess.run([FF, '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True).stdout
    return list(struct.unpack('<%dh' % (len(raw) // 2), raw))

def trim_start(x, th=600):
    for i, v in enumerate(x):
        if abs(v) > th: return x[max(0, i - 80):]
    return x

def extend(x, total, ls, le, xf):
    """把 [ls, le) 作为持续段反复接上（每段之间做等功率交叉淡化），直到 total 个样本"""
    out = x[:le]
    seg = x[ls:le]
    n = max(64, int(xf))
    assert le - ls > n * 2
    while len(out) < total:
        off = random.randint(0, max(0, (le - ls) // 4))
        s = x[ls + off:le]
        if len(s) < n * 2: s = seg
        tail = out[-n:]; out = out[:-n]
        for i in range(n):
            a = i / n
            out.append(int(tail[i] * math.cos(a * math.pi / 2) + s[i] * math.sin(a * math.pi / 2)))
        out.extend(s[n:])
    out = out[:total]
    rel = int(SR * 0.35)
    for i in range(rel):
        out[-rel + i] = int(out[-rel + i] * (1 - i / rel) ** 1.5)
    return out

def sustain(x, lo=0.55):
    """自动找持续段：攻击之后，RMS 不低于峰值 lo 倍的最长连续区间"""
    W = SR // 50
    r = [(sum(v * v for v in x[i:i + W]) / W) ** 0.5 for i in range(0, len(x) - W, W)]
    pk = max(r); best = (0, 0); st = None
    s0 = int(0.18 * 50)
    for i in range(s0, len(r)):
        if r[i] >= pk * lo:
            if st is None: st = i
            if i - st > best[1] - best[0]: best = (st, i)
        else: st = None
    a, b = best
    m = max(1, (b - a) // 8)
    ls, le = (a + m) * W, (b - m) * W
    if le - ls < int(SR * 0.4):
        if lo > 0.25: return sustain(x, lo - 0.1)
        ls, le = int(len(x) * 0.35), int(len(x) * 0.75)
    return ls, le

def write_mp3(samples, name, q='5'):
    peak = max(1, max(abs(v) for v in samples)); g = 30000 / peak
    tmp = f'/tmp/sfx_{name}.wav'
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(struct.pack('<%dh' % len(samples), *[max(-32767, min(32767, int(v * g))) for v in samples]))
    run([FF, '-y', '-v', 'error', '-i', tmp, '-c:a', 'libmp3lame', '-q:a', q, f'{OUT}/{name}.mp3'])
    os.remove(tmp)

ERHU = {62: 'd5', 64: 'e5', 66: 'gb5', 69: 'a5', 71: 'b5', 74: 'd6', 76: 'e6', 78: 'gb6', 81: 'a6'}
DIZI = {74: '074', 76: '076', 79: '079', 81: '081', 84: '084', 86: '086', 89: '089'}
FLUTE_LOOP = {'072': (87567, 98619), '074': (97089, 116320), '076': (115788, 133441), '079': (100100, 114753), '081': (86258, 99318), '084': (81092, 92071), '086': (99150, 118956), '089': (73518, 81779)}

def build_inst():
    for m, n in ERHU.items():
        x = trim_start(read_mono(f'{SRC}/cn/erhu/{n}.wav'))
        ls, le = sustain(x)
        print('erhu', m, ls / SR, le / SR)
        write_mp3(extend(x, int(SR * 4.2), ls, le, min(SR * 0.12, (le - ls) // 3)), f'erhu_{m}')
    for m, n in DIZI.items():
        p = f'{SRC}/SP-Bamboo-Flute/samples/BambooFlute {n}L.wav'
        x = read_mono(p)
        x = trim_start(x)
        ls, le = sustain(x)
        print('dizi', m, ls / SR, le / SR)
        write_mp3(extend(x, int(SR * 3.6), ls, le, min(SR * 0.08, (le - ls) // 3)), f'dizi_{m}')
    x = trim_start(read_mono(f'{SRC}/SP-Bamboo-Flute/samples/Shaku-like 2.wav'))
    ls, le = sustain(x, 0.5); print('xiao', ls / SR, le / SR)
    write_mp3(extend(x, int(SR * 4.0), ls, le, min(SR * 0.1, (le - ls) // 3)), 'xiao_77')

def gen_ts():
    names = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith('.mp3'))
    lines = ['// 由 tools/sfxbuild.py 生成——CC0 音效与乐器采样（内联，双击 index.html 也能用）']
    for i, n in enumerate(names): lines.append(f"import s{i} from '../assets/sfx/{n}.mp3?inline';")
    lines.append('export const SFX_DATA: Record<string, string> = {')
    for i, n in enumerate(names): lines.append(f"  '{n}': s{i},")
    lines.append('};')
    open(TS, 'w').write('\n'.join(lines) + '\n')
    tot = sum(os.path.getsize(f'{OUT}/{n}.mp3') for n in names)
    print(len(names), 'files', tot // 1024, 'KB')

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:]
    if not only or 'sfx' in only:
        for k, (src, d, _) in SFX.items(): build_sfx(k, src, d)
    if not only or 'inst' in only: build_inst()
    gen_ts()
