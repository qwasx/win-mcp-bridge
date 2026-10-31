"""Normalize the supplied RGB art drafts into straight-alpha, tileable PNGs."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, PngImagePlugin
from scipy.ndimage import gaussian_filter, median_filter

SOURCE = Path('.mood/mood_textures_all')
TARGET = Path('src/assets/mood')
TARGET.mkdir(parents=True, exist_ok=True)
SIZES = {
    'far_mtn_1': (2048, 400), 'far_mtn_2': (2048, 520), 'far_mtn_3': (2048, 640),
    'sky_dawn_mist': (2048, 360), 'sky_dusk_glow': (2048, 360), 'sky_cloud_band': (2048, 300),
    'moon_full': (512, 512), 'moon_crescent': (512, 512), 'sky_starriver': (2048, 512),
    'rain_veil': (1024, 1024), 'mist_band_1': (1024, 256), 'mist_band_2': (1024, 256),
    'mist_puff_1': (512, 512), 'mist_puff_2': (512, 512), 'wild_geese': (1024, 256),
    'lone_sail': (384, 512), 'fishing_light': (256, 256), 'cooking_smoke': (256, 768),
    'reed_marsh': (768, 384), 'lotus_withered': (512, 384), 'plum_branch': (512, 512),
    'paper_grain': (1024, 1024), 'ink_vignette': (1024, 1024),
}


def smooth(a, lo, hi):
    t = np.clip((a - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def seamless(a, both=False):
    # Blend only boundary strips, preserving one unique full-length scroll.
    n = max(16, a.shape[1] // 16)
    for i in range(n):
        k = (1 - i / n) ** 2 * 0.5
        l, r = a[:, i].copy(), a[:, -1-i].copy()
        a[:, i], a[:, -1-i] = l * (1-k) + r * k, r * (1-k) + l * k
    a[:, -1] = a[:, 0]
    if both:
        a = np.swapaxes(a, 0, 1)
        a = seamless(a)
        a = np.swapaxes(a, 0, 1)
    return a


manifest = {}
for name, size in SIZES.items():
    im = Image.open(SOURCE / (name + '.png')).convert('RGB').resize(size, Image.Resampling.LANCZOS)
    a = np.asarray(im, dtype=np.float32) / 255
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    u, v = xx / max(1, w-1), yy / max(1, h-1)
    rgb = a.copy()
    sat = a.max(2) - a.min(2)
    lum = a.mean(2)
    fade = smooth(u, 0, .06) * (1-smooth(u, .94, 1)) * smooth(v, 0, .05) * (1-smooth(v, .94, 1))
    tile = name.startswith(('far_mtn', 'sky_')) or name in ('rain_veil', 'paper_grain')
    if name.startswith('far_mtn'):
        paper = np.median(a[:max(2, h//8)].reshape(-1, 3), axis=0)
        pigment = (paper[0]-paper[2]) - (a[:,:,0]-a[:,:,2])
        alpha = smooth(pigment, .009, .20) * (1-smooth(v, .62, .79))
        rgb = np.clip((a - paper[None,None,:] * (1-alpha[:,:,None])) / np.maximum(alpha[:,:,None], .08), 0, 1)
        rgb = rgb * .68 + np.array([.34, .49, .49]) * .32
        alpha *= smooth(v, .10, .20)
    elif name == 'paper_grain':
        rgb = np.clip(a, .60, 1)
        alpha = np.ones((h,w))
    elif name == 'ink_vignette':
        dist = np.minimum.reduce([u, 1-u, v, 1-v])
        noise = gaussian_filter(np.random.default_rng(46).random((h,w)), 12)
        alpha = (1-smooth(dist, .005, .15)) * (.08 + noise * .12)
        rgb[:] = [.23, .27, .24]
    elif name in ('moon_full', 'moon_crescent'):
        alpha = smooth(lum, .10 if name == 'moon_full' else .18, .68)
        if name == 'moon_full':
            r = np.hypot((u-.5)*1.02, v-.5)
            disc=1-smooth(r,.325,.337)
            halo=np.exp(-((r-.355)/.017)**2)*.12+np.exp(-((r-.405)/.025)**2)*.035
            alpha=np.maximum(disc*.94,halo)
            rgb = rgb * .10 + np.array([1,.97,.85]) * .90
        alpha *= fade
    elif name == 'sky_starriver':
        filtered = gaussian_filter(lum, 1.2)
        alpha = smooth(filtered, .18, .65) * smooth(v, .08, .30) * (1-smooth(v,.73,.96))
        rgb[:] = [.84,.90,.94]
    elif name == 'rain_veil':
        alpha = np.clip((lum - median_filter(lum, size=9) - .045) * 2.1, 0, .27) * .45
        rgb[:] = [.80,.87,.87]
    elif name == 'fishing_light':
        alpha = smooth(a[:,:,0] - a[:,:,2], .04, .48) * fade
        rgb[:] = [1, .70, .29]
    elif name == 'cooking_smoke':
        alpha = smooth(gaussian_filter(lum, 2), .40, .78) * fade * .7
        rgb[:] = [.83,.86,.81]
    elif name == 'wild_geese':
        alpha = (1-smooth(lum, .15, .39)) * fade
        rgb[:] = [.15,.22,.21]
    elif name in ('plum_branch','reed_marsh','lone_sail'):
        alpha = np.maximum(smooth(sat, .045, .16), 1-smooth(lum, .17, .39))
        if name == 'reed_marsh':
            alpha = np.maximum(smooth(sat, .055, .19), smooth(lum, .67, .90))
            rgb = np.clip(a * .65 + np.array([.61,.55,.38]) * .35, 0, 1)
        alpha = gaussian_filter(alpha * fade, .45)
    elif name == 'lotus_withered':
        alpha = (1-smooth(lum, .5, .93)) * fade
        rgb[:] = [.22,.25,.21]
    elif name == 'mist_band_1':
        alpha = gaussian_filter(smooth(1-lum, .025, .19) * fade * .7, 1)
        rgb[:] = [.86,.90,.86]
    elif name in ('mist_band_2','mist_puff_2'):
        alpha = gaussian_filter(smooth(sat, .025, .11) * fade * .58, 1.5)
        rgb[:] = [.85,.90,.88]
    elif name == 'mist_puff_1':
        alpha = smooth(1-lum, .025, .25) * fade * .62
        rgb[:] = [.85,.90,.85]
    else:
        chroma = a[:,:,1] - (a[:,:,0]+a[:,:,2])*.5
        if name == 'sky_dusk_glow':
            alpha = smooth(a[:,:,0]-a[:,:,2], .05, .32) * smooth(v,.18,.34) * (1-smooth(v,.72,.90))
            rgb[:] = [.73,.43,.28]
        else:
            alpha = smooth(chroma, .013, .095) * smooth(v,.10,.28) * (1-smooth(v,.70,.9))
            rgb[:] = [.66,.78,.70]
    rgba = np.dstack([rgb, np.clip(alpha, 0, 1)])
    if tile:
        rgba = seamless(rgba, name in ('paper_grain', 'rain_veil'))
    rgba[rgba[:,:,3] < .006] = 0
    pnginfo=PngImagePlugin.PngInfo();pnginfo.add(b'sRGB',b'\x00')
    Image.fromarray(np.uint8(np.clip(rgba,0,1)*255), 'RGBA').save(TARGET/(name+'.png'), optimize=True,pnginfo=pnginfo)
    manifest[name] = {'width':w,'height':h,'mode':'RGBA','tile_x':tile,'tile_y':name in ('paper_grain','rain_veil'),'source':'mood-textures-23','alpha_min':int(np.min(rgba[:,:,3])*255),'alpha_max':int(np.max(rgba[:,:,3])*255)}

(TARGET/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
sheet=Image.new('RGB',(1200,6*190),'#c43c38')
d=ImageDraw.Draw(sheet)
for n,name in enumerate(SIZES):
    im=Image.open(TARGET/(name+'.png')); im.thumbnail((288,155))
    x=(n%4)*300; y=(n//4)*190
    sheet.paste(im,(x+6,y+25),im); d.text((x+6,y+5),name,fill='white')
sheet.save('.downloads/alpha-review.png')
print(f'Prepared {len(manifest)} straight-alpha mood textures.')