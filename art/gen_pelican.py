#!/usr/bin/env python3
"""Generate art/pelican-bicycle.svg — a pelican riding a bicycle.

The result is a single self-contained SVG: the wheels, cranks and legs are
animated with CSS transforms + SMIL path morphing, the scenery with CSS
keyframes. Open it in any browser (works as an <img> too).

Run:  python3 art/gen_pelican.py
"""

import math
from pathlib import Path

# ---------------------------------------------------------------- geometry ---
REAR = (280.0, 398.0)          # rear hub
FRONT = (600.0, 398.0)         # front hub
R = 66.0                        # wheel radius
BB = (425.0, 410.0)            # bottom bracket
CRANK = 26.0
SEAT = (335.0, 300.0)
HEAD_TUBE_TOP = (552.0, 296.0)
HEAD_TUBE_BOT = (566.0, 344.0)
HIP = (350.0, 280.0)
L1, L2 = 88.0, 84.0            # thigh / shin (sum > full pedal stroke)
KD = None                       # None: keep the knee as high as possible
FRAMES = 8
PERIOD = 1.2                    # seconds per crank revolution
KT = ";".join(
    (f"{i / FRAMES:.4f}".rstrip("0").rstrip(".") or "0") for i in range(FRAMES + 1)
)

NEAR, NEAR_D = "#F0A24E", "#DC8C36"
FAR, FAR_D = "#CE8A41", "#B4722A"


# ----------------------------------------------------------------- helpers ---
def knee(h, p, l1, l2):
    """Two-circle IK; KD picks the side the knee juts to."""
    dx, dy = p[0] - h[0], p[1] - h[1]
    d = math.hypot(dx, dy)
    d = max(abs(l1 - l2) + 0.01, min(d, l1 + l2 - 0.01))
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    hh = math.sqrt(max(l1 * l1 - a * a, 0.0))
    ux, uy = dx / d, dy / d
    bx, by = h[0] + ux * a, h[1] + uy * a
    k1 = (bx - uy * hh, by + ux * hh)
    k2 = (bx + uy * hh, by - ux * hh)
    if KD is None:                      # raised-knee rider pose
        return k1 if k1[1] < k2[1] else k2
    return k1 if (k1[0] - k2[0]) * KD > 0 else k2


def pedal(angle_deg):
    """Pedal axle position for a crank angle (0 = top, clockwise)."""
    a = math.radians(angle_deg)
    return (BB[0] + CRANK * math.sin(a), BB[1] - CRANK * math.cos(a))


def foot(ax, ay, s=1.0):
    """Webbed foot resting on the pedal, toes forward (ax, ay = ankle)."""
    p = [
        (ax - 4 * s, ay - 1.5 * s),
        (ax + 14 * s, ay - 1 * s),
        (ax + 22 * s, ay + 1.5 * s),
        (ax + 15 * s, ay + 3.5 * s),
        (ax + 20 * s, ay + 6.5 * s),
        (ax + 10 * s, ay + 7 * s),
        (ax - 4 * s, ay + 6 * s),
    ]
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in p) + " Z"


def leg_parts(offset, phase, ankle_drop, s):
    h = (HIP[0] + offset[0], HIP[1] + offset[1])
    ax, ay = pedal(phase)
    ankle = (ax + offset[0], ay - ankle_drop + offset[1])
    k = knee(h, ankle, L1 * s, L2 * s)
    return h, k, ankle


def anim(attr, values, extra=""):
    return (
        f'<animate attributeName="{attr}" dur="{PERIOD}s" repeatCount="indefinite" '
        f'calcMode="linear" keyTimes="{KT}" values="{";".join(values)}"{extra}/>'
    )


def leg_group(offset, phase, ankle_drop, s, tw, sw, color, foot_fill, static=None):
    """Thigh, shin, knee joint and foot — all morphing through the pedal cycle."""
    if static is None:
        parts = [leg_parts(offset, phase + 360.0 * i / FRAMES, ankle_drop, s)
                 for i in range(FRAMES)]
        parts.append(parts[0])
    else:
        parts = [leg_parts(offset, static + phase, ankle_drop, s)]

    (hx, hy), (kx, ky), (ax, ay) = parts[0]
    moving = static is None
    thigh = anim("d", [f"M{p[0][0]:.1f},{p[0][1]:.1f} L{p[1][0]:.1f},{p[1][1]:.1f}"
                       for p in parts]) if moving else ""
    shin = anim("d", [f"M{p[1][0]:.1f},{p[1][1]:.1f} L{p[2][0]:.1f},{p[2][1]:.1f}"
                      for p in parts]) if moving else ""
    knee_c = (
        anim("cx", [f"{p[1][0]:.1f}" for p in parts])
        + anim("cy", [f"{p[1][1]:.1f}" for p in parts])
    ) if moving else ""
    foot_a = anim("d", [foot(p[2][0], p[2][1], s) for p in parts]) if moving else ""

    return f"""
    <path fill="none" stroke="{color}" stroke-width="{tw}" stroke-linecap="round"
          d="M{hx:.1f},{hy:.1f} L{kx:.1f},{ky:.1f}">{thigh}</path>
    <path fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round"
          d="M{kx:.1f},{ky:.1f} L{ax:.1f},{ay:.1f}">{shin}</path>
    <circle r="{sw * 0.72:.1f}" fill="{color}" cx="{kx:.1f}" cy="{ky:.1f}">{knee_c}</circle>
    <path fill="{foot_fill}" d="{foot(ax, ay, s)}">{foot_a}</path>"""


def spokes(cx, cy, n=10):
    return "".join(
        f'<line x1="{cx:.1f}" y1="{cy:.1f}" '
        f'x2="{cx + 53 * math.cos(math.radians(360.0 * i / n)):.1f}" '
        f'y2="{cy + 53 * math.sin(math.radians(360.0 * i / n)):.1f}"/>'
        for i in range(n)
    )


def wheel(cx, cy, rot=None):
    wheel_rot = ""
    if rot is not None:
        wheel_rot = f' transform="rotate({rot:.1f} {cx} {cy})"'

    return f"""
    <circle cx="{cx}" cy="{cy}" r="{R}" fill="none" stroke="#39404D" stroke-width="11"/>
    <circle cx="{cx}" cy="{cy}" r="55" fill="none" stroke="#D7DEE4" stroke-width="6"/>
    <g class="spokes spin" fill="none" stroke="#AEB9C3" stroke-width="2.4"{wheel_rot}>
      {spokes(cx, cy)}
    </g>
    <circle cx="{cx}" cy="{cy}" r="7.5" fill="#586373"/>
    <circle cx="{cx}" cy="{cy}" r="3" fill="#B9C3CD"/>"""


def cloud(x, y, s, delay, static=False):
    style = "" if static else f' style="animation-delay:-{delay}s"'
    return f"""
    <g class="cloud"{style} opacity="0.92">
      <g transform="translate({x} {y}) scale({s})" fill="#FFFFFF">
        <ellipse cx="0" cy="0" rx="42" ry="22"/>
        <circle cx="-22" cy="4" r="17"/>
        <circle cx="16" cy="-8" r="21"/>
      </g>
    </g>"""


WRAP = 900.0


def clouds(static=False):
    """Two identical banks of clouds one loop-width apart -> seamless drift."""
    bank = [(150, 96, 1.0), (470, 58, 0.78), (760, 150, 0.62)]
    out = []
    for k in (0, 1):
        for i, (x, y, s) in enumerate(bank):
            out.append(cloud(x + k * WRAP, y, s, i * 9.5, static))
    return "".join(out)


# -------------------------------------------------------------------- build ---
def build(static=None):
    """Return the SVG source. static=<degrees> renders one frozen crank frame."""
    still = static is not None
    scene_cls = ' class="static"' if still else ""

    wrot = None if static is None else (static * PERIOD / 0.7) % 360.0
    near = leg_group((0, 0), 0, 10, 1.0, 17, 12, NEAR, NEAR_D, static)
    far = leg_group((-12, -6), 180, 12, 0.96, 15, 11, FAR, FAR_D, static)

    crank_near_style = (f' style="transform:rotate({static:.1f}deg)"'
                        if still else "")
    crank_far_style = (f' style="transform:rotate({static + 180:.1f}deg)"'
                       if still else f' style="animation-delay:-{PERIOD / 2}s"')
    pedal_near_style = (f' style="transform:rotate({-static:.1f}deg)"'
                        if still else "")
    pedal_far_style = (f' style="transform:rotate({-static - 180:.1f}deg)"'
                       if still else f' style="animation-delay:-{PERIOD / 2}s"')

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 540" width="800" height="540" role="img" aria-label="A pelican riding a bicycle">
<title>鹈鹕骑自行车 · Pelican riding a bicycle</title>
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFF9F0"/>
    <stop offset="0.55" stop-color="#FDEBD2"/>
    <stop offset="1" stop-color="#F9DDBB"/>
  </linearGradient>
  <linearGradient id="body" x1="0.25" y1="0" x2="0.75" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="0.5" stop-color="#FAF5EA"/>
    <stop offset="1" stop-color="#E9E0CC"/>
  </linearGradient>
  <linearGradient id="bodyFar" x1="0.3" y1="0" x2="0.7" y2="1">
    <stop offset="0" stop-color="#F3ECDC"/>
    <stop offset="1" stop-color="#DED3BA"/>
  </linearGradient>
  <linearGradient id="pouch" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#F9C46B"/>
    <stop offset="1" stop-color="#EFA345"/>
  </linearGradient>
  <linearGradient id="beak" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#F6B45C"/>
    <stop offset="1" stop-color="#E9892F"/>
  </linearGradient>
  <clipPath id="frame"><rect width="800" height="540"/></clipPath>
  <radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#FFE3AE" stop-opacity="0.95"/>
    <stop offset="0.55" stop-color="#FFEAC2" stop-opacity="0.5"/>
    <stop offset="1" stop-color="#FFEFD0" stop-opacity="0"/>
  </radialGradient>
</defs>

<style>
  .spin     {{ animation: spin 0.7s linear infinite; }}
  .crank    {{ animation: spin {PERIOD}s linear infinite; }}
  .pedal    {{ animation: spin-rev {PERIOD}s linear infinite; }}
  .spokes, .crank, .pedal {{ transform-box: view-box; }}
  .static .crank, .static .pedal {{ animation: none; }}
  #rear-wheel .spokes  {{ transform-origin: {REAR[0]}px {REAR[1]}px; }}
  #front-wheel .spokes {{ transform-origin: {FRONT[0]}px {FRONT[1]}px; }}
  #crank-near, #crank-far {{ transform-origin: {BB[0]}px {BB[1]}px; }}
  /* pedals orbit with the crank but stay level: counter-rotate about their own centre */
  #pedal-near, #pedal-far {{ transform-origin: {BB[0]}px {BB[1] - CRANK}px; }}
  @keyframes spin     {{ from {{ transform: rotate(0deg); }} to {{ transform: rotate(360deg); }} }}
  @keyframes spin-rev {{ from {{ transform: rotate(0deg); }} to {{ transform: rotate(-360deg); }} }}
  .cloud    {{ animation: drift 34s linear infinite; }}
  @keyframes drift {{ from {{ transform: translateX(0px); }} to {{ transform: translateX(-{WRAP:.0f}px); }} }}
  .road-dash {{ animation: dash {PERIOD}s linear infinite; }}
  @keyframes dash {{ from {{ transform: translateX(0); }} to {{ transform: translateX(-120px); }} }}
  .bob      {{ animation: bob {PERIOD}s ease-in-out infinite; }}
  @keyframes bob {{ 0%,100% {{ transform: translateY(0px); }} 50% {{ transform: translateY(2.4px); }} }}
  .wing     {{ animation: flap {PERIOD}s ease-in-out infinite;
               transform-origin: 392px 202px; transform-box: view-box; }}
  @keyframes flap {{ 0%,100% {{ transform: rotate(0deg); }} 50% {{ transform: rotate(-2deg); }} }}
  .scarf    {{ animation: flutter 0.55s ease-in-out infinite alternate;
               transform-origin: 404px 200px; transform-box: view-box; }}
  @keyframes flutter {{ from {{ transform: rotate(-3.5deg); }} to {{ transform: rotate(4deg); }} }}
  .puff     {{ animation: puff {PERIOD}s linear infinite; transform-box: view-box; }}
  @keyframes puff {{
      0%   {{ opacity: 0;    transform: translate(0,0) scale(0.4); }}
      25%  {{ opacity: 0.5; }}
      100% {{ opacity: 0;    transform: translate(-74px,-14px) scale(1.6); }}
  }}
  .whoosh   {{ animation: whoosh 0.95s linear infinite; }}
  @keyframes whoosh {{
      0%   {{ opacity: 0;    transform: translateX(30px); }}
      30%  {{ opacity: 0.55; }}
      100% {{ opacity: 0;    transform: translateX(-64px); }}
  }}
  .blink  {{ animation: blink 4.7s infinite; transform-box: view-box;
             transform-origin: 487px 129px; }}
  @keyframes blink {{
      0%, 92%, 100% {{ transform: scaleY(1); }}
      95% {{ transform: scaleY(0.08); }}
  }}
  .shadow {{ animation: squash {PERIOD}s ease-in-out infinite;
             transform-box: view-box; transform-origin: 440px 470px; }}
  @keyframes squash {{ 0%,100% {{ transform: scale(1); }} 50% {{ transform: scale(0.975,1); }} }}
  .static .cloud, .static .road-dash, .static .whoosh, .static .puff,
  .static .bob, .static .wing, .static .scarf, .static .blink,
  .static .shadow, .static .spin {{ animation: none; }}
  @media (prefers-reduced-motion: reduce) {{ svg * {{ animation: none !important; }} }}
</style>

<g{scene_cls}>
<!-- scenery -->
<rect width="800" height="540" fill="url(#sky)"/>
<circle cx="692" cy="94" r="112" fill="url(#sunGlow)"/>
<circle cx="692" cy="94" r="40" fill="#FFD48E"/>

<g clip-path="url(#frame)">{clouds(still)}</g>

<path d="M0,436 C 90,404 170,428 250,414 C 340,398 420,424 520,412 C 620,400 700,420 800,404 L800,470 L0,470 Z" fill="#DCE6CF"/>
<path d="M0,452 C 120,432 210,452 320,440 C 430,428 520,448 640,438 C 720,431 760,442 800,436 L800,470 L0,470 Z" fill="#CBDAB8"/>

<rect x="0" y="466" width="800" height="74" fill="#EBD9C2"/>
<rect x="0" y="466" width="800" height="5" fill="#DFC9AC"/>
<g class="road-dash" fill="#DCC4A5">
  <rect x="-10" y="502" width="64" height="7" rx="3.5"/>
  <rect x="110" y="502" width="64" height="7" rx="3.5"/>
  <rect x="230" y="502" width="64" height="7" rx="3.5"/>
  <rect x="350" y="502" width="64" height="7" rx="3.5"/>
  <rect x="470" y="502" width="64" height="7" rx="3.5"/>
  <rect x="590" y="502" width="64" height="7" rx="3.5"/>
  <rect x="710" y="502" width="64" height="7" rx="3.5"/>
  <rect x="830" y="502" width="64" height="7" rx="3.5"/>
</g>
<g fill="#C2D2AE">
  <path d="M40,470 q6,-16 12,0 q-6,-6 -12,0 Z"/>
  <path d="M92,468 q5,-14 11,0 q-6,-5 -11,0 Z"/>
  <path d="M760,470 q6,-15 12,0 q-6,-6 -12,0 Z"/>
</g>

<ellipse class="shadow" cx="440" cy="470" rx="212" ry="11" fill="#5B4A38" opacity="0.13"/>

<!-- speed lines -->
<g class="whoosh" stroke="#EDCFB2" stroke-width="6" stroke-linecap="round" fill="none">
  <path d="M104,236 L180,236"/>
</g>
<g class="whoosh" style="animation-delay:-0.32s" stroke="#EDCFB2" stroke-width="5" stroke-linecap="round" fill="none">
  <path d="M76,282 L144,282"/>
</g>
<g class="whoosh" style="animation-delay:-0.64s" stroke="#EDCFB2" stroke-width="4" stroke-linecap="round" fill="none">
  <path d="M112,330 L168,330"/>
</g>

<!-- dust puffs -->
<g fill="#E8D6C0">
  <g class="puff"><circle cx="214" cy="458" r="8"/></g>
  <g class="puff" style="animation-delay:-0.4s"><circle cx="198" cy="463" r="6"/></g>
  <g class="puff" style="animation-delay:-0.8s"><circle cx="208" cy="449" r="5.5"/></g>
</g>

<!-- bike -->
<g id="rear-wheel">{wheel(REAR[0], REAR[1], wrot)}</g>
<g id="front-wheel">{wheel(FRONT[0], FRONT[1], wrot)}</g>

<g stroke="#8B95A1" stroke-width="3" fill="none">
  <path d="M{BB[0]},{BB[1] - 20} L{REAR[0]},{REAR[1] - 9}"/>
  <path d="M{BB[0]},{BB[1] + 20} L{REAR[0]},{REAR[1] + 9}"/>
</g>
<circle cx="{REAR[0]}" cy="{REAR[1]}" r="9" fill="none" stroke="#6C7683" stroke-width="4"/>

<!-- far leg (behind the frame) -->
{far}

<g stroke="#1F8A8C" stroke-width="9" stroke-linecap="round" fill="none">
  <path d="M{BB[0]},{BB[1]} L{SEAT[0]},{SEAT[1]}"/>
  <path d="M{SEAT[0]},{SEAT[1]} L{HEAD_TUBE_TOP[0]},{HEAD_TUBE_TOP[1]}"/>
  <path d="M{BB[0]},{BB[1]} L{HEAD_TUBE_BOT[0]},{HEAD_TUBE_BOT[1]}"/>
  <path d="M{HEAD_TUBE_TOP[0]},{HEAD_TUBE_TOP[1]} L{HEAD_TUBE_BOT[0]},{HEAD_TUBE_BOT[1]}" stroke-width="11"/>
  <path d="M{BB[0]},{BB[1]} L{REAR[0]},{REAR[1]}"/>
  <path d="M{SEAT[0]},{SEAT[1]} L{REAR[0]},{REAR[1]}"/>
  <path d="M{HEAD_TUBE_BOT[0]},{HEAD_TUBE_BOT[1]} Q 584,370 {FRONT[0]},{FRONT[1]}"/>
</g>
<path d="M{SEAT[0] + 6},{SEAT[1] + 20} L{HEAD_TUBE_TOP[0] - 6},{HEAD_TUBE_TOP[1] + 6}"
      stroke="#39A6A8" stroke-width="3" stroke-linecap="round" opacity="0.8"/>

<!-- saddle -->
<path d="M{SEAT[0]},{SEAT[1]} l-4,-20" stroke="#8B95A1" stroke-width="6" stroke-linecap="round"/>
<path d="M{SEAT[0] - 36},282 C {SEAT[0] - 32},264 {SEAT[0] + 22},260 {SEAT[0] + 28},274
         C {SEAT[0] + 31},283 {SEAT[0] + 10},287 {SEAT[0] - 10},287
         C {SEAT[0] - 24},287 {SEAT[0] - 36},289 {SEAT[0] - 36},282 Z" fill="#4A5563"/>

<!-- stem + handlebar -->
<path d="M{HEAD_TUBE_TOP[0]},{HEAD_TUBE_TOP[1] - 2} L554,270" stroke="#8B95A1" stroke-width="7" stroke-linecap="round"/>
<path d="M546,274 C 566,258 586,256 600,266" stroke="#4A5563" stroke-width="8" stroke-linecap="round" fill="none"/>

<!-- far crank -->
<g id="crank-far" class="crank"{crank_far_style}>
  <line x1="{BB[0]:.0f}" y1="{BB[1]:.0f}" x2="{BB[0]:.0f}" y2="{BB[1] - CRANK:.0f}"
        stroke="#7E8B99" stroke-width="7" stroke-linecap="round" opacity="0.85"/>
  <g id="pedal-far" class="pedal"{pedal_far_style}>
    <rect x="{BB[0] - 11:.0f}" y="{BB[1] - CRANK - 3:.0f}" width="22" height="6" rx="3" fill="#6D7887"/>
  </g>
</g>


<!-- near crank -->
<g id="crank-near" class="crank"{crank_near_style}>
  <line x1="{BB[0]:.0f}" y1="{BB[1]:.0f}" x2="{BB[0]:.0f}" y2="{BB[1] - CRANK:.0f}"
        stroke="#C3CDD6" stroke-width="8" stroke-linecap="round"/>
  <g id="pedal-near" class="pedal"{pedal_near_style}>
    <rect x="{BB[0] - 13:.0f}" y="{BB[1] - CRANK - 4:.0f}" width="26" height="8" rx="4" fill="#3B4552"/>
  </g>
</g>
<circle cx="{BB[0]}" cy="{BB[1]}" r="21" fill="#F4F1E9" stroke="#4A5563" stroke-width="4"/>
<circle cx="{BB[0]}" cy="{BB[1]}" r="7" fill="#4A5563"/>

<!-- pelican -->
<g class="bob">
  <!-- tail -->
  <path d="M316,236 L252,216 L272,238 L246,244 L276,258 L254,272 L318,266 Z" fill="url(#bodyFar)"/>
  <path d="M300,244 L268,232 M300,252 L262,252 M300,258 L272,268"
        stroke="#D3C7AC" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.8"/>

  <!-- body -->
  <path d="M302,250 C296,208 330,184 372,186 C412,188 430,214 430,250
           C430,282 400,300 362,300 C324,300 306,284 302,250 Z" fill="url(#body)"/>
  <path d="M330,290 C352,299 392,297 414,281 C402,296 366,304 330,290 Z" fill="#E2D8C2" opacity="0.55"/>

  <!-- hip tuft -->
  <path d="M322,282 C342,272 378,274 396,290 C378,296 340,298 322,292 Z" fill="#FBF6EB"/>

  <!-- near leg -->
  {near}

  <!-- neck -->
  <path d="M404,210 C416,170 436,152 466,150" fill="none" stroke="url(#body)" stroke-width="36" stroke-linecap="round"/>
  <path d="M414,202 C426,176 442,164 460,160" fill="none" stroke="#FFFFFF" stroke-width="8"
        stroke-linecap="round" opacity="0.35"/>
  <path d="M394,218 C404,206 412,196 420,186" fill="none" stroke="#E3D9C3" stroke-width="3"
        stroke-linecap="round" opacity="0.5"/>

  <!-- head -->
  <circle cx="476" cy="144" r="28" fill="url(#body)"/>
  <path d="M456,120 q-10,-20 1,-29 q7,14 16,18" fill="#F1EADA"/>
  <path d="M470,115 q-1,-17 10,-22 q-3,13 4,20" fill="#F7F2E5"/>

  <!-- beak -->
  <path d="M496,126 C556,132 616,148 656,166 C652,175 643,178 632,174 C596,161 546,151 496,147 Z" fill="url(#beak)"/>
  <path d="M494,144 C538,151 600,163 650,173 C644,200 592,212 546,201 C512,194 494,173 494,144 Z" fill="url(#pouch)"/>
  <path d="M502,152 C542,160 596,170 642,178" fill="none" stroke="#E08F35" stroke-width="3" opacity="0.5"/>
  <path d="M514,170 C542,184 580,192 612,190" fill="none" stroke="#E79A3E" stroke-width="3" opacity="0.35"/>
  <path d="M496,126 C556,132 616,148 656,166" fill="none" stroke="#D98A34" stroke-width="2.4" opacity="0.5"/>
  <ellipse cx="512" cy="133" rx="4" ry="1.8" fill="#C9762A" opacity="0.55"/>

  <!-- eye -->
  <g class="blink">
    <circle cx="487" cy="129" r="7" fill="#3A332B"/>
    <circle cx="484.4" cy="126.2" r="2.3" fill="#FFFFFF"/>
  </g>
  <circle cx="487" cy="129" r="11.5" fill="none" stroke="#E8C69B" stroke-width="2.5" opacity="0.9"/>

  <!-- scarf: two ribbons streaming back, then the collar band round the neck -->
  <g class="scarf">
    <path d="M410,186 C384,180 366,158 334,152 C344,166 352,176 366,184
             C384,190 400,192 410,190 Z" fill="#E4572E"/>
    <path d="M410,190 C392,196 372,200 346,198 C358,208 372,212 392,210
             C402,208 408,204 412,198 Z" fill="#C9471F"/>
    <path d="M344,157 C360,163 376,175 392,183" fill="none" stroke="#FFD9C9"
          stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  </g>
  <path d="M402,185 L437,165" stroke="#E4572E" stroke-width="14" stroke-linecap="butt"/>
  <path d="M404,182 L431,168" stroke="#C9471F" stroke-width="3" stroke-linecap="butt" opacity="0.45"/>
  <path d="M401,184 a9,9 0 1,0 13,-5 z" fill="#E4572E"/>

  <!-- wing: shoulder to handlebar, gripping the grip -->
  <g class="wing">
    <path d="M386,196 C424,202 476,220 524,236 C550,246 570,254 584,261
             C578,270 566,275 552,273 C506,264 452,258 414,250
             C384,240 376,214 386,196 Z" fill="#F6F1E4" stroke="#E3D9C2" stroke-width="2"/>
    <path d="M414,250 C452,258 502,262 552,273 C546,281 526,284 504,280
             C466,272 432,266 412,260 Z" fill="#E7DFCC"/>
    <g fill="none" stroke="#DCD2BC" stroke-width="2.4" stroke-linecap="round">
      <path d="M424,210 C448,218 470,226 490,234"/>
      <path d="M418,230 C442,240 466,246 486,250"/>
      <path d="M422,246 C446,252 468,256 486,258"/>
    </g>
    <!-- feather fingers closing over the grip -->
    <g fill="#FBF7EC" stroke="#E3D9C2" stroke-width="1.8" stroke-linejoin="round">
      <path d="M572,256 C584,258 592,262 596,266 C588,270 578,270 570,267 Z"/>
      <path d="M574,266 C586,268 594,271 597,275 C589,279 578,278 572,275 Z"/>
    </g>
    <path d="M596,266 C602,267 605,271 602,274 C597,275 593,272 592,269 Z"
          fill="#E7DFCC" stroke="#D8CFB8" stroke-width="1.5"/>
  </g>

  <!-- bar end peeking out of the hand -->
  <path d="M598,265 C606,267 609,272 605,276" fill="none" stroke="#3A4450"
        stroke-width="7" stroke-linecap="round"/>
</g>
</g>
{REDUCED_MOTION_JS}
</svg>
"""


REDUCED_MOTION_JS = """<script type="text/javascript"><![CDATA[
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var root = document.documentElement;
      if (root.pauseAnimations) root.pauseAnimations();
    }
  } catch (e) {}
]]></script>"""


if __name__ == "__main__":
    out = Path(__file__).with_name("pelican-bicycle.svg")
    svg = build()
    out.write_text(svg, encoding="utf-8")
    print(f"wrote {out} ({len(svg)} bytes)")
