#!/usr/bin/env python3
"""
Pelican Test — a hand-built SVG of a pelican riding a bicycle.

Everything here is geometry: wheels, frame, chain, and the bird are all
computed from a small set of anchor points, so the pose stays consistent and
the legs land on the pedals instead of floating next to them.

    python3 build.py            # writes pelican.svg + index.html

No dependencies. The generated SVG is pure markup (no fonts, no images),
so it renders identically in a browser, in resvg/Inkscape, or as a data URI.
"""

from __future__ import annotations

import math
from pathlib import Path

OUT = Path(__file__).resolve().parent

# ---------------------------------------------------------------- canvas ----
W, H = 800, 600
GROUND = 542.0  # tyres touch down here

# ------------------------------------------------------------------ bike ----
REAR_HUB = (296.0, 470.0)
FRONT_HUB = (508.0, 470.0)
WHEEL_R = 72.0
BB = (400.0, 478.0)          # bottom bracket / cranks
CRANK_R = 32.0
SEAT_TOP = (344.0, 336.0)    # top of seat tube
HEAD_TOP = (487.0, 336.0)    # top of head tube
HEAD_BOT = (497.0, 386.0)
BAR_GRIP = (467.0, 303.0)

# --------------------------------------------------------------- pelican ----
BODY = (346.0, 260.0)
HIP_NEAR = (352.0, 318.0)
HIP_FAR = (366.0, 314.0)
HEAD = (430.0, 166.0)
THIGH, SHIN = 106.0, 100.0

NEAR_CRANK_DEG = 22.0
FAR_CRANK_DEG = NEAR_CRANK_DEG + 180.0

# ---------------------------------------------------------------- colours ---
INK = "#33302c"
BODY_FILL = "#fcf9f2"
BODY_SHADE = "#e7e0d0"
BODY_SHADE2 = "#d6cdb9"
BILL = "#f6b23a"
BILL_LIGHT = "#ffd27a"
BILL_DARK = "#cf8a1c"
POUCH = "#f2a12b"
POUCH_DARK = "#d1831a"
LEG = "#ef9530"
LEG_DARK = "#b8671d"
FRAME = "#cf3b2f"
FRAME_DARK = "#9e2b24"
FRAME_LIGHT = "#e8665a"
CHROME = "#cfd7e0"
CHROME_DARK = "#8e969f"
TYRE = "#2b2b31"
SCARF = "#2c7d76"
SCARF_DARK = "#1d5852"


# ------------------------------------------------------------------ maths ---
def pt(cx: float, cy: float, r: float, deg: float) -> tuple[float, float]:
    a = math.radians(deg)
    return cx + r * math.cos(a), cy + r * math.sin(a)


def f(v: float) -> str:
    """Compact number formatting so the markup stays readable."""
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def p2(p: tuple[float, float]) -> str:
    return f"{f(p[0])} {f(p[1])}"


def two_bone_ik(
    hip: tuple[float, float],
    ankle: tuple[float, float],
    l1: float,
    l2: float,
    bend: float = 1.0,
) -> tuple[float, float]:
    """Knee position; `bend` picks which side of the hip→ankle line it lands on."""
    dx, dy = ankle[0] - hip[0], ankle[1] - hip[1]
    raw = math.hypot(dx, dy)
    d = min(raw, l1 + l2 - 1e-6)
    ux, uy = dx / raw, dy / raw
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = math.sqrt(max(l1 * l1 - a * a, 0.0))
    base = (hip[0] + ux * a, hip[1] + uy * a)
    k1 = (base[0] - uy * h, base[1] + ux * h)
    k2 = (base[0] + uy * h, base[1] - ux * h)
    return k1 if (k1[0] - k2[0]) * bend > 0 else k2


def pedal(deg: float) -> tuple[float, float]:
    return pt(BB[0], BB[1], CRANK_R, deg)


def ankle_for(deg: float, near: bool) -> tuple[float, float]:
    """The ankle sits a touch forward of, and above, the pedal spindle."""
    p = pedal(deg)
    return (p[0] + (3.0 if near else -1.0), p[1] - 9.0)


# ------------------------------------------------------------------ parts ---
def spokes(prefix: str = "") -> str:
    out = []
    for i in range(16):
        a = i * 22.5
        x1, y1 = pt(0, 0, 13, a)
        x2, y2 = pt(0, 0, WHEEL_R - 7, a + 9)
        out.append(
            f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" '
            f'stroke="{CHROME}" stroke-width="1.5" opacity=".8"/>'
        )
    return "".join(out)


def wheel(cx: float, cy: float) -> str:
    r = WHEEL_R
    return f"""
<g class="wheel" data-cx="{f(cx)}" data-cy="{f(cy)}">
  <circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="none" stroke="{TYRE}" stroke-width="12"/>
  <circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r - 6.5)}" fill="none" stroke="{CHROME}" stroke-width="3.6"/>
  <circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r - 2)}" fill="none" stroke="#4a4a52" stroke-width="1.6"
          stroke-dasharray="2 12" opacity=".8"/>
  <g transform="translate({f(cx)} {f(cy)})">{spokes()}</g>
  <circle cx="{f(cx)}" cy="{f(cy)}" r="7" fill="{CHROME}" stroke="{INK}" stroke-width="2"/>
  <circle cx="{f(cx)}" cy="{f(cy)}" r="2.2" fill="{CHROME_DARK}"/>
</g>"""


def chain() -> str:
    ring_r, cog_r = 21.0, 9.0
    top = f"M{f(BB[0])} {f(BB[1] - ring_r)}L{f(REAR_HUB[0])} {f(REAR_HUB[1] - cog_r)}"
    bot = f"M{f(BB[0])} {f(BB[1] + ring_r)}L{f(REAR_HUB[0])} {f(REAR_HUB[1] + cog_r)}"
    return f"""
<g class="chain" stroke="#89909a" stroke-width="3" fill="none" stroke-linecap="round">
  <path d="{top}"/><path d="{bot}"/>
</g>
<g class="chain-dash" stroke="#525860" stroke-width="1.2" stroke-dasharray="3 4" fill="none">
  <path d="{top}"/><path d="{bot}"/>
</g>
<circle cx="{f(REAR_HUB[0])}" cy="{f(REAR_HUB[1])}" r="10" fill="none" stroke="#9aa1aa" stroke-width="3"/>
<circle cx="{f(REAR_HUB[0])}" cy="{f(REAR_HUB[1])}" r="6.5" fill="#b9c0c9" stroke="#7d838c" stroke-width="1.6"/>"""


def chainring(deg: float = 0.0) -> str:
    teeth = []
    for i in range(26):
        a = i * (360 / 26)
        x1, y1 = pt(BB[0], BB[1], 18.5, a)
        x2, y2 = pt(BB[0], BB[1], 22.5, a)
        teeth.append(f"M{f(x1)} {f(y1)}L{f(x2)} {f(y2)}")
    # five crank spider arms
    arms = []
    for i in range(5):
        a = i * 72
        x, y = pt(BB[0], BB[1], 17, a)
        arms.append(f"M{p2(BB)}L{f(x)} {f(y)}")
    return f"""
<g class="chainring" transform="rotate({f(deg)} {f(BB[0])} {f(BB[1])})">
  <circle cx="{f(BB[0])}" cy="{f(BB[1])}" r="19.5" fill="#b3bac3" stroke="#767c85" stroke-width="2"/>
  <path d="{''.join(teeth)}" stroke="#8d939c" stroke-width="2.6"/>
  <path d="{''.join(arms)}" stroke="#8d939c" stroke-width="4" stroke-linecap="round"/>
  <circle cx="{f(BB[0])}" cy="{f(BB[1])}" r="6" fill="{CHROME}" stroke="#6d737b" stroke-width="1.8"/>
</g>"""


def frame() -> str:
    tubes = [
        (BB, SEAT_TOP),          # seat tube
        (BB, HEAD_BOT),          # down tube
        (SEAT_TOP, HEAD_TOP),    # top tube
        (BB, REAR_HUB),          # chainstay
        (SEAT_TOP, REAR_HUB),    # seatstay
        (HEAD_TOP, HEAD_BOT),    # head tube
    ]
    d = "".join(f"M{p2(a)}L{p2(b)}" for a, b in tubes)
    fork = (
        f"M{p2(HEAD_BOT)}C{f(HEAD_BOT[0] + 7)} {f(HEAD_BOT[1] + 36)} "
        f"{f(FRONT_HUB[0] - 3)} {f(FRONT_HUB[1] - 36)} {p2(FRONT_HUB)}"
    )
    return f"""
<g class="frame">
  <path d="{d}" fill="none" stroke="{FRAME_DARK}" stroke-width="13"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="{d}" fill="none" stroke="{FRAME}" stroke-width="9"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M{p2(BB)}L{f(SEAT_TOP[0] + 2)} {f(SEAT_TOP[1] + 6)}" stroke="{FRAME_LIGHT}"
        stroke-width="2.4" stroke-linecap="round" opacity=".75"/>
  <path d="{fork}" fill="none" stroke="{FRAME_DARK}" stroke-width="12" stroke-linecap="round"/>
  <path d="{fork}" fill="none" stroke="{FRAME}" stroke-width="8" stroke-linecap="round"/>
  <path d="{fork}" fill="none" stroke="{FRAME_LIGHT}" stroke-width="2" stroke-linecap="round"
        opacity=".6" transform="translate(-1.6 0)"/>
  <circle cx="{f(BB[0])}" cy="{f(BB[1])}" r="8" fill="none" stroke="{FRAME_DARK}" stroke-width="4"/>
</g>"""


def saddle() -> str:
    return """
<g class="saddle">
  <path d="M306 330C308 320 322 313 344 312C364 311 378 315 380 322C381 328 372 332 356 333
           L316 340C306 341 303 336 306 330Z"
        fill="#5b4636" stroke="#3b2c22" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M314 325C324 318 340 315 356 316" fill="none" stroke="#7d6149" stroke-width="3.4"
        stroke-linecap="round"/>
  <circle cx="322" cy="334" r="2.4" fill="#8a7a66" stroke="#3b2c22" stroke-width="1.4"/>
  <circle cx="356" cy="330" r="2.4" fill="#8a7a66" stroke="#3b2c22" stroke-width="1.4"/>
</g>"""


def handlebar() -> str:
    return f"""
<g class="cockpit">
  <!-- stem -->
  <path d="M{f(HEAD_TOP[0])} {f(HEAD_TOP[1])}C494 326 494 318 490 312"
        fill="none" stroke="{CHROME_DARK}" stroke-width="9" stroke-linecap="round"/>
  <path d="M{f(HEAD_TOP[0])} {f(HEAD_TOP[1])}C494 326 494 318 490 312"
        fill="none" stroke="{CHROME}" stroke-width="6" stroke-linecap="round"/>
  <!-- swept-back bar -->
  <path d="M490 312C492 298 484 288 471 292C463 294 460 300 463 305"
        fill="none" stroke="{CHROME_DARK}" stroke-width="10" stroke-linecap="round"/>
  <path d="M490 312C492 298 484 288 471 292C463 294 460 300 463 305"
        fill="none" stroke="{CHROME}" stroke-width="7" stroke-linecap="round"/>
  <!-- grip -->
  <path d="M468 294C462 293 458 297 459 303C460 308 465 310 470 307"
        fill="none" stroke="#3d434b" stroke-width="11" stroke-linecap="round"/>
  <!-- bell -->
  <g transform="translate(489 293)">
    <circle r="6" fill="#f0c94a" stroke="#8d7320" stroke-width="1.8"/>
    <path d="M-2.4 3h4.8" stroke="#8d7320" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="-1.4" cy="-1.8" r="1.4" fill="#fff4c2" opacity=".9"/>
  </g>
</g>"""



def pelican() -> str:
    """Body, tail, neck, head, bill. Drawn after the near crank."""
    bx, by = BODY
    hx, hy = HEAD
    return f"""
<g class="pelican">
  <!-- tail: short, pointed, level with the hips -->
  <g stroke="{INK}" stroke-width="2.4" stroke-linejoin="round">
    <path d="M300 250C282 246 260 252 242 264C254 272 270 274 282 270C270 280 262 288 256 298
             C276 294 294 284 308 272Z" fill="{BODY_SHADE}"/>
    <path d="M296 258C282 260 268 266 256 274M294 268C282 272 270 278 260 286" fill="none"
          stroke="{BODY_SHADE2}" stroke-width="2" opacity=".9"/>
  </g>

  <!-- body -->
  <ellipse cx="{f(bx)}" cy="{f(by)}" rx="66" ry="57" fill="{BODY_FILL}" stroke="{INK}"
           stroke-width="3" transform="rotate(-18 {f(bx)} {f(by)})"/>
  <path d="M298 294C314 320 348 330 376 314C398 302 410 280 411 258C396 292 354 310 320 290Z"
        fill="{BODY_SHADE}"/>
  <path d="M306 286C322 304 348 312 370 302" fill="none" stroke="{BODY_SHADE2}"
        stroke-width="2.4" stroke-linecap="round" opacity=".85"/>
  <path d="M326 222C350 210 376 212 394 228" fill="none" stroke="#ffffff" stroke-width="4"
        stroke-linecap="round" opacity=".9"/>

  <!-- folded wing on the back -->
  <g>
    <path d="M334 212C366 216 394 232 410 254C416 264 412 274 402 270C388 265 378 254 364 246
             C344 235 324 220 314 206C322 206 328 208 334 212Z"
          fill="{BODY_SHADE}" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M346 226C364 234 382 246 394 260M330 218C346 226 360 236 372 246" fill="none"
          stroke="{BODY_SHADE2}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M402 266C408 272 412 280 410 286C404 286 398 278 394 271Z" fill="{BODY_SHADE}"
          stroke="{INK}" stroke-width="2.2" stroke-linejoin="round"/>
  </g>

  <!-- neck: short and thick, the S kept tight -->
  <path d="M368 238C374 210 388 192 404 184" fill="none" stroke="{INK}" stroke-width="40"
        stroke-linecap="round"/>
  <path d="M368 238C374 210 388 192 404 184" fill="none" stroke="{BODY_FILL}" stroke-width="34"
        stroke-linecap="round"/>
  <path d="M384 214C388 202 396 193 406 188" fill="none" stroke="{BODY_SHADE}" stroke-width="8"
        stroke-linecap="round" opacity=".9"/>

  <!-- head -->
  <ellipse cx="{f(hx)}" cy="{f(hy)}" rx="29" ry="25" fill="{BODY_FILL}" stroke="{INK}"
           stroke-width="3" transform="rotate(-6 {f(hx)} {f(hy)})"/>
  <path d="M402 150C397 145 395 138 398 133C403 138 409 141 414 142C409 145 404 147 402 150Z"
        fill="{BODY_SHADE}" stroke="{INK}" stroke-width="2" stroke-linejoin="round"/>

  <!-- bill: one unit — mandible on top, pouch slung underneath -->
  <g>
    <!-- pouch, deepest at the throat and tapering to the tip -->
    <path d="M442 166C444 196 454 224 478 236C508 250 552 222 584 192C534 182 482 173 442 166Z"
          fill="{POUCH}" stroke="{INK}" stroke-width="2.8" stroke-linejoin="round"/>
    <path d="M450 180C454 204 464 222 484 230" fill="none" stroke="{BILL_LIGHT}"
          stroke-width="3.4" stroke-linecap="round" opacity=".85"/>
    <path d="M456 198C470 218 494 228 520 224" fill="none" stroke="{POUCH_DARK}"
          stroke-width="2.6" stroke-linecap="round" opacity=".7"/>
    <!-- upper mandible: thick at the base, hooked at the tip -->
    <path d="M436 148C494 150 552 162 592 182C598 185 601 192 595 196C589 200 583 195 577 192
             C532 181 484 171 440 164C432 161 430 150 436 148Z"
          fill="{BILL}" stroke="{INK}" stroke-width="2.8" stroke-linejoin="round"/>
    <path d="M444 156C498 160 550 170 584 185" fill="none" stroke="{BILL_DARK}"
          stroke-width="2.2" stroke-linecap="round" opacity=".65"/>
    <path d="M446 161C500 166 550 175 582 188" fill="none" stroke="{BILL_LIGHT}"
          stroke-width="2.2" stroke-linecap="round" opacity=".8"/>
    <!-- gape line where the mandible meets the pouch -->
    <path d="M440 166C486 175 536 184 582 193" fill="none" stroke="{INK}" stroke-width="2"
          stroke-linecap="round" opacity=".85"/>
    <!-- nail -->
    <path d="M581 184C589 185 594 190 592 196C590 201 583 199 580 194C578 190 578 186 581 184Z"
          fill="#e08f1c" stroke="{INK}" stroke-width="2.2" stroke-linejoin="round"/>
  </g>

  <!-- eye -->
  <circle cx="435" cy="161" r="8.4" fill="#fffdf8" stroke="{INK}" stroke-width="2"/>
  <circle cx="436.4" cy="161.6" r="4.3" fill="#241f1c"/>
  <circle cx="438.2" cy="159.4" r="1.5" fill="#fff"/>

  <!-- scarf: narrow band round the neck, knot at the throat -->
  <g class="scarf">
    <g transform="rotate(52 380 201)">
      <rect x="360" y="194" width="40" height="12" rx="6" fill="{SCARF}" stroke="{SCARF_DARK}"
            stroke-width="1.8"/>
      <path d="M361 197.5h38" stroke="#57a49c" stroke-width="1.6" opacity=".85"/>
    </g>
    <path d="M377 209C384 207 391 211 391 217C391 223 384 227 377 223C372 220 372 212 377 209Z"
          fill="{SCARF}" stroke="{SCARF_DARK}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M379 213C383 212 386 214 387 217" fill="none" stroke="#57a49c" stroke-width="1.6"
          stroke-linecap="round" opacity=".9"/>
  </g>
</g>"""


def scarf_tail() -> str:
    """The tied ends of the scarf, hanging over the wing behind the knot."""
    return f"""
<g class="scarf-tail">
  <path d="M388 212C392 222 392 234 387 246C385 252 378 252 377 246C375 234 376 222 380 212Z"
        fill="{SCARF}" stroke="{SCARF_DARK}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M396 216C402 226 405 238 403 249C401 255 394 255 393 249C391 238 390 226 389 218Z"
        fill="{SCARF}" stroke="{SCARF_DARK}" stroke-width="1.8" stroke-linejoin="round" opacity=".92"/>
  <path d="M383 224C383 232 382 240 381 245M397 228C399 236 400 243 399 248" fill="none"
        stroke="#57a49c" stroke-width="1.5" stroke-linecap="round" opacity=".75"/>
</g>"""


def thigh_feather(hip: tuple[float, float], knee: tuple[float, float], near: bool) -> str:
    """Feathered 'trousers' over the top half of the thigh."""
    dx, dy = knee[0] - hip[0], knee[1] - hip[1]
    ln = math.hypot(dx, dy) or 1.0
    ux, uy = dx / ln, dy / ln
    px, py = -uy, ux
    t = 0.5 * ln
    a = (hip[0] + ux * t, hip[1] + uy * t)
    w1, w2 = 20.0, 13.0
    fill = BODY_FILL if near else BODY_SHADE
    return f"""
<path d="M{f(hip[0] + px * w1)} {f(hip[1] + py * w1)}
         C{f(hip[0] + ux * t * .6 + px * (w1 + 3))} {f(hip[1] + uy * t * .6 + py * (w1 + 3))}
          {f(a[0] + px * w2)} {f(a[1] + py * w2)} {f(a[0] + px * 3)} {f(a[1] + py * 3)}
         C{f(a[0] - px * 8)} {f(a[1] - py * 8)} {f(hip[0] + ux * t * .5 - px * (w1 + 2))}
          {f(hip[1] + uy * t * .5 - py * (w1 + 2))} {f(hip[0] - px * w1)} {f(hip[1] - py * w1)}Z"
      fill="{fill}" stroke="{INK}" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M{f(a[0] - px * 9)} {f(a[1] - py * 9)}C{f(hip[0] + ux * t * .55 - px * 14)}
         {f(hip[1] + uy * t * .55 - py * 14)} {f(hip[0] + ux * 10 - px * 15)}
         {f(hip[1] + uy * 10 - py * 15)} {f(hip[0] + ux * 4 - px * 13)} {f(hip[1] + uy * 4 - py * 13)}"
      fill="none" stroke="{BODY_SHADE2}" stroke-width="2" stroke-linecap="round" opacity=".85"/>"""


def leg(deg: float, hip: tuple[float, float], near: bool) -> str:
    """Crank arm + pedal + the leg whose foot lands on it."""
    ped = pedal(deg)
    ankle = ankle_for(deg, near)
    knee = two_bone_ik(hip, ankle, THIGH, SHIN)
    d = f"M{p2(hip)}L{p2(knee)}L{p2(ankle)}"
    col = LEG if near else "#c3731f"
    out = LEG_DARK if near else "#8a4c13"
    op = "" if near else ' opacity=".85"'
    foot_deg = -10 if near else 6
    foot = f"""
<g class="foot" transform="translate({f(ped[0])} {f(ped[1])}) rotate({f(foot_deg)})">
  <path d="M-12 1C-13 -6 -7 -10 1 -9L23 -6C31 -5 33 1 26 4L6 9C-3 11 -11 8 -12 1Z"
        fill="{col}" stroke="{out}" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M2 -8L4 6M10 -7L12 5M18 -6L19 3" stroke="{out}" stroke-width="1.7"
        stroke-linecap="round" opacity=".7"/>
  <path d="M-9 -2C-1 -5 12 -4 22 -3" fill="none" stroke="#ffd9a0" stroke-width="1.8"
        stroke-linecap="round" opacity=".7"/>
</g>"""
    return f"""
<g class="crank" data-deg="{f(deg)}" data-near="{1 if near else 0}">
  <path d="M{p2(BB)}L{p2(ped)}" stroke="{'#a7aeb7' if near else '#6f757e'}" stroke-width="7"
        stroke-linecap="round"/>
  <rect x="{f(ped[0] - 12)}" y="{f(ped[1] + 1)}" width="24" height="6" rx="3"
        fill="{'#5d636b' if near else '#43484f'}" stroke="{INK}" stroke-width="1.4"/>
  <circle cx="{f(ped[0])}" cy="{f(ped[1] + 4)}" r="2.6" fill="#e0a33c"/>
  <path class="leg-out" d="{d}" fill="none" stroke="{out}" stroke-width="16"
        stroke-linecap="round" stroke-linejoin="round"{op}/>
  <path class="leg-in" d="{d}" fill="none" stroke="{col}" stroke-width="10.5"
        stroke-linecap="round" stroke-linejoin="round"{op}/>
  <path class="leg-hi" d="{d}" fill="none" stroke="#ffd9a0" stroke-width="2.6"
        opacity="{0.55 if near else 0.35}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle class="knee" cx="{f(knee[0])}" cy="{f(knee[1])}" r="5.6" fill="{col}" stroke="{out}"
          stroke-width="2.4"{op}/>
  {thigh_feather(hip, knee, near)}
  {foot}
</g>"""


def wing_on_bar() -> str:
    """Near wing reaching forward; pointed primaries wrap the grip."""
    return f"""
<g class="wing">
  <path d="M342 206C376 218 406 236 436 262C446 271 454 282 457 291C459 299 452 305 445 300
           C436 293 426 288 416 283C400 275 384 267 370 259C356 251 346 242 340 232
           C336 222 336 210 342 206Z"
        fill="{BODY_FILL}" stroke="{INK}" stroke-width="2.8" stroke-linejoin="round"/>
  <path d="M354 216C382 228 410 246 436 270" fill="none" stroke="{BODY_SHADE}"
        stroke-width="2.2" stroke-linecap="round" opacity=".95"/>
  <path d="M368 220C392 231 414 246 436 266" fill="none" stroke="{BODY_SHADE2}"
        stroke-width="1.8" stroke-linecap="round" opacity=".75"/>
  <path d="M350 211C368 219 384 227 398 235" fill="none" stroke="#ffffff" stroke-width="3.6"
        stroke-linecap="round" opacity=".85"/>
  <path d="M392 268C386 261 380 255 374 249M420 285C414 279 408 274 402 269" fill="none"
        stroke="{BODY_SHADE2}" stroke-width="1.8" stroke-linecap="round" opacity=".9"/>

  <!-- hand: pointed primaries closing round the grip -->
  <g>
    <path d="M436 268C450 276 462 288 466 298C468 304 464 308 458 305C450 300 442 292 435 284Z"
          fill="{BODY_SHADE}" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M444 279C454 288 461 296 463 303C464 308 460 311 455 307C448 301 442 293 438 286Z"
          fill="{BODY_FILL}" stroke="{INK}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M446 286C453 293 458 299 459 304" fill="none" stroke="{BODY_SHADE2}"
          stroke-width="1.8" stroke-linecap="round" opacity=".85"/>
  </g>
</g>"""


def background() -> str:
    return f"""
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#cbe6f1"/>
    <stop offset=".55" stop-color="#eaf5f4"/>
    <stop offset="1" stop-color="#f7f2e5"/>
  </linearGradient>
  <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8cc2ce"/>
    <stop offset="1" stop-color="#bcdfe2"/>
  </linearGradient>
  <radialGradient id="sunglow" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#ffe0a3" stop-opacity=".95"/>
    <stop offset="1" stop-color="#ffe0a3" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#d0c7b5"/>
    <stop offset="1" stop-color="#b7ac97"/>
  </linearGradient>
  <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#d6e4da"/>
    <stop offset="1" stop-color="#c2d5c9"/>
  </linearGradient>
</defs>

<rect width="{W}" height="{H}" fill="url(#sky)"/>
<circle cx="648" cy="128" r="128" fill="url(#sunglow)"/>
<circle cx="648" cy="128" r="40" fill="#ffe7b8"/>

<!-- distant hills -->
<path d="M0 404C80 372 150 386 214 400C286 416 330 386 404 392C470 398 520 388 590 396C670 404 740 392 800 402V470H0Z"
      fill="url(#hill)"/>
<!-- sea -->
<path d="M0 428H800V486H0Z" fill="url(#sea)"/>
<g stroke="#eaf6f4" stroke-width="3" stroke-linecap="round" opacity=".85">
  <path d="M60 448h46M150 462h60M300 442h38M470 458h52M600 444h44M700 470h54M40 478h50M380 476h44"/>
</g>
<g transform="translate(196 430)" opacity=".92">
  <path d="M0 22h44l-7 8H8Z" fill="#5f7d7c"/>
  <path d="M21 2L21 21M21 2L4 20h17M23 5L38 20H23Z" fill="#fdfaf3" stroke="#5f7d7c"
        stroke-width="1.6" stroke-linejoin="round"/>
</g>

<!-- road -->
<path d="M0 486H800V600H0Z" fill="url(#road)"/>
<path d="M0 486H800" stroke="#a89c86" stroke-width="3"/>
<g stroke="#f3ebdb" stroke-width="6" stroke-linecap="round" opacity=".85">
  <path d="M34 522h64M154 522h64M274 522h64M394 522h64M514 522h64M634 522h64M754 522h46"/>
</g>
<g stroke="#7f9a6a" stroke-width="3" stroke-linecap="round" opacity=".9">
  <path d="M20 492c4-10 6-16 12-22M28 492c-2-9-6-14-12-18M86 492c4-9 7-15 13-20M94 492c-3-8-8-13-14-16
           M742 492c5-11 8-17 15-22M752 492c-3-9-8-15-15-18M660 492c4-9 7-14 12-19M668 492c-2-7-6-12-11-15"/>
</g>
<!-- gulls -->
<g fill="none" stroke="#8ba3ad" stroke-width="3" stroke-linecap="round" opacity=".9">
  <path d="M120 178c8-8 14-8 20 0c6-8 12-8 20 0"/>
  <path d="M232 126c6-6 11-6 16 0c5-6 10-6 16 0"/>
  <path d="M300 194c5-5 9-5 13 0c4-5 8-5 13 0"/>
</g>
<!-- contact shadow -->
<ellipse cx="402" cy="546" rx="190" ry="16" fill="#8b7f68" opacity=".32"/>
<ellipse cx="402" cy="544" rx="150" ry="10" fill="#7a6f59" opacity=".26"/>"""


def scene() -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"
     role="img" aria-labelledby="t d">
  <title id="t">A pelican riding a bicycle</title>
  <desc id="d">Hand-built SVG: a white pelican in a teal scarf, one wing on the handlebar,
  both feet on the pedals of a red vintage bicycle, riding along a coastal road.</desc>
{background()}

<g id="rig">
  <!-- far side of the bike: far leg, chain, then the frame over it -->
  {wheel(*REAR_HUB)}
  {wheel(*FRONT_HUB)}
  {leg(FAR_CRANK_DEG, HIP_FAR, near=False)}
  {chain()}
  {frame()}
  {saddle()}
  {handlebar()}
  {chainring()}
  {leg(NEAR_CRANK_DEG, HIP_NEAR, near=True)}
  {pelican()}
  {wing_on_bar()}
  {scarf_tail()}
</g>
</svg>"""


# ------------------------------------------------------------------- page ---
PAGE = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>鹈鹕测试 · 一只骑自行车的鹈鹕</title>
<style>
  :root {
    color-scheme: light;
    --ink: #26241f;
    --muted: #6b6459;
    --paper: #f6f1e6;
    --card: #fffdf8;
    --line: #e2d9c7;
    --accent: #cf3b2f;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 40px 20px 72px;
    background: radial-gradient(circle at 18% 8%, #fffaf0 0%, transparent 55%), var(--paper);
    color: var(--ink);
    font: 16px/1.65 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia,
          "Songti SC", "Noto Serif CJK SC", serif;
  }
  .wrap { max-width: 920px; margin: 0 auto; }
  .kicker {
    font: 600 12px/1 ui-monospace, "SF Mono", Menlo, monospace;
    letter-spacing: .18em; text-transform: uppercase; color: var(--accent);
  }
  h1 { font-size: clamp(30px, 5vw, 44px); line-height: 1.15; margin: 12px 0 10px; letter-spacing: -.01em; }
  h1 em { font-style: normal; color: var(--accent); }
  .lede { margin: 0; max-width: 62ch; color: #4b463d; }
  .stage {
    margin: 28px 0 0; background: var(--card); border: 1px solid var(--line);
    border-radius: 18px; padding: 14px;
    box-shadow: 0 18px 40px -28px rgba(60,48,30,.55), 0 2px 0 #fff inset;
  }
  .stage svg { display: block; width: 100%; height: auto; border-radius: 12px; }
  .bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 14px; }
  button {
    font: 600 14px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
    padding: 11px 16px; border-radius: 999px; border: 1px solid #cfc4ae;
    background: #fffdf7; color: var(--ink); cursor: pointer;
    transition: transform .12s ease, background .18s ease, border-color .18s ease;
  }
  button:hover { background: #f3ecdd; }
  button:active { transform: translateY(1px); }
  button[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: #fdf8ee; }
  .score { margin-left: auto; font: 600 13px/1 ui-monospace, Menlo, monospace; color: var(--muted); }
  .score b { color: var(--accent); font-size: 15px; }
  section { margin-top: 34px; }
  h2 { font-size: 20px; margin: 0 0 10px; letter-spacing: .01em; }
  p { margin: 0 0 12px; }
  .grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; }
  .card h3 { margin: 0 0 6px; font-size: 15px; }
  .card p { margin: 0; font-size: 14.5px; color: #575147; }
  code, pre { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  pre {
    background: #26241f; color: #f2eadb; border-radius: 12px; padding: 16px 18px;
    overflow: auto; font-size: 13px; line-height: 1.55;
  }
  pre .c { color: #9c9484; }
  ul.checks { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
  ul.checks li {
    display: flex; gap: 10px; align-items: baseline; font-size: 14.5px; color: #4b463d;
    padding: 9px 12px; background: #fffdf8; border: 1px solid var(--line); border-radius: 10px;
  }
  ul.checks .mark { font-weight: 700; color: #2f7d78; }
  footer { margin-top: 40px; font-size: 13px; color: var(--muted); }
  a { color: var(--accent); }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="kicker">Pelican Test</div>
    <h1>一只<em>鹈鹕</em>，骑着自行车</h1>
    <p class="lede">
      同一个提示词 —— <code>Generate an SVG of a pelican riding a bicycle</code> ——
      喂给不同的模型，看谁会真的把「骑」画出来。这一只不是图片，是纯手写几何：
      两条腿都算到踏板上，翅膀扶在车把上，全图零位图、零字体依赖。
    </p>
  </header>

  <figure class="stage" style="margin-left:0;margin-right:0">
    __SVG__
    <div class="bar">
      <button id="play" aria-pressed="false">▶ 让它骑起来</button>
      <button id="save">下载 SVG</button>
      <span class="score" id="score">空间检查 <b>—</b></span>
    </div>
  </figure>

  <section>
    <h2>这道题在测什么</h2>
    <div class="grid">
      <div class="card">
        <h3>空间关系</h3>
        <p>鸟得坐在车座上、脚在踏板上、翅膀在车把上。最典型的失败是鹈鹕悬浮在自行车上方 20 像素。</p>
      </div>
      <div class="card">
        <h3>结构完整性</h3>
        <p>两个轮子同高、圆心对齐、车架闭合、链条连着牙盘和后飞轮。少一根管子，车就散架了。</p>
      </div>
      <div class="card">
        <h3>概念组合</h3>
        <p>大喙、喉囊、蹼足这些鹈鹕特征，必须和自行车的几何拼成一个动作，而不是两件东西并排放。</p>
      </div>
    </div>
  </section>

  <section>
    <h2>这一版是怎么搭的</h2>
    <p>不是凭手感画坐标，而是先定几个锚点，其余全部推出来：</p>
    <pre><span class="c"># 锚点</span>
REAR_HUB  = (296, 470)   FRONT_HUB = (508, 470)   <span class="c"># 同一条 y，轮子才站得平</span>
BB        = (400, 478)   <span class="c"># 中轴，比轴心略低</span>
SEAT_TOP  = (344, 336)   HEAD_TOP  = (487, 336)   <span class="c"># 上管水平，车架闭合</span>

<span class="c"># 腿：两段式 IK，反解膝盖位置，脚落在踏板圆上</span>
pedal = BB + CRANK_R * (cos θ, sin θ)
knee  = two_bone_ik(hip, ankle, THIGH=106, SHIN=100)

<span class="c"># 曲柄转 1°，另一条腿就是 1° + 180°，所以永远一前一后</span></pre>
    <p style="margin-top:14px">
      换来的是：脚跟踏板永远咬着，两个轮子和牙盘可以绕各自圆心转，而画面不散。
      点上面的「让它骑起来」，看的就是这套 IK 在实时跑。
    </p>
  </section>

  <section>
    <h2>自检（页面里真算的）</h2>
    <ul class="checks" id="checks"></ul>
  </section>

  <footer>
    非官方基准，<a href="https://simonwillison.net/tags/pelican-riding-a-bicycle/">Simon Willison 的鹈鹕骑自行车测试</a>
    的民间变体。本页为纯手写 SVG，单文件、无外部资源。
  </footer>
</div>

<script>
(() => {
  const art = document.querySelector('.stage svg');
  if (!art) return;

  const GEO = {
    bb: [400, 478], crankR: 32,
    thigh: 106, shin: 100,
    near: { hip: [__HIP_NX__, __HIP_NY__], deg: __NEAR_DEG__, dir: 1,  ankleDx: 3,  ankleDy: -9 },
    far:  { hip: [__HIP_FX__, __HIP_FY__], deg: __FAR_DEG__,  dir: -1, ankleDx: -1, ankleDy: -9 },
    wheelR: 72, hubs: [[__RH_X__, __RH_Y__], [__FH_X__, __FH_Y__]], ground: __GROUND__,
    grip: [__GRIP_X__, __GRIP_Y__], shoulder: [356, 228]
  };

  const rad = d => d * Math.PI / 180;
  const pedal = deg => [
    GEO.bb[0] + GEO.crankR * Math.cos(rad(deg)),
    GEO.bb[1] + GEO.crankR * Math.sin(rad(deg))
  ];

  function ik(hip, ankle, l1, l2) {
    const dx = ankle[0] - hip[0], dy = ankle[1] - hip[1];
    const raw = Math.hypot(dx, dy);
    const d = Math.min(raw, l1 + l2 - 1e-6);
    const ux = dx / raw, uy = dy / raw;
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
    const bx = hip[0] + ux * a, by = hip[1] + uy * a;
    const k1 = [bx - uy * h, by + ux * h];
    const k2 = [bx + uy * h, by - ux * h];
    return k1[0] > k2[0] ? k1 : k2;   // knees point forward
  }

  const cranks = [...art.querySelectorAll('.crank')].map(g => {
    const near = g.getAttribute('data-near') === '1';
    return {
      g, near,
      legOut: g.querySelector('.leg-out'),
      legIn: g.querySelector('.leg-in'),
      legHi: g.querySelector('.leg-hi'),
      knee: g.querySelector('.knee'),
      foot: g.querySelector('.foot'),
      arm: g.querySelector('path'),
      pedalRect: g.querySelector('rect'),
      deg: Number(g.getAttribute('data-deg'))
    };
  });
  const wheels = [...art.querySelectorAll('.wheel')].map(w => ({
    node: w, cx: Number(w.getAttribute('data-cx')), cy: Number(w.getAttribute('data-cy'))
  }));
  const chainring = art.querySelector('.chainring');
  const chainPaths = [...art.querySelectorAll('.chain path, .chain-dash path')];

  let t0 = 0, raf = 0, playing = false, angle = 0;
  const SPEED = 0.5; // degrees of crank rotation per millisecond

  function pose(c, deg) {
    const phase = c.near ? GEO.near : GEO.far;
    const p = pedal(deg);
    const ankle = [p[0] + phase.ankleDx, p[1] + phase.ankleDy];
    const knee = ik(phase.hip, ankle, GEO.thigh, GEO.shin);
    const d = `M${phase.hip[0]} ${phase.hip[1]}L${knee[0]} ${knee[1]}L${ankle[0]} ${ankle[1]}`;
    c.legOut.setAttribute('d', d);
    c.legIn.setAttribute('d', d);
    c.legHi.setAttribute('d', d);
    c.knee.setAttribute('cx', knee[0]);
    c.knee.setAttribute('cy', knee[1]);
    c.arm.setAttribute('d', `M${GEO.bb[0]} ${GEO.bb[1]}L${p[0]} ${p[1]}`);
    c.pedalRect.setAttribute('x', p[0] - 12);
    c.pedalRect.setAttribute('y', p[1] + 1);
    c.foot.setAttribute('transform',
      `translate(${p[0]} ${p[1]}) rotate(${c.near ? -10 : 6})`);
  }

  function frame(ts) {
    if (!t0) t0 = ts;
    angle = ((ts - t0) * SPEED) % 360;
    cranks.forEach(c => pose(c, c.deg + angle));
    wheels.forEach(w => w.node.setAttribute('transform',
      `rotate(${(angle * 1.85).toFixed(1)} ${w.cx} ${w.cy})`));
    chainring.setAttribute('transform',
      `rotate(${angle.toFixed(1)} ${GEO.bb[0]} ${GEO.bb[1]})`);
    if (playing) raf = requestAnimationFrame(frame);
  }

  const playBtn = document.getElementById('play');
  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.textContent = playing ? '⏸ 停下' : '▶ 让它骑起来';
    if (playing) { t0 = 0; raf = requestAnimationFrame(frame); }
    else cancelAnimationFrame(raf);
  });

  document.getElementById('save').addEventListener('click', () => {
    const clone = art.cloneNode(true);
    const src = '<?xml version="1.0" encoding="UTF-8"?>\\n' +
      new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pelican-riding-a-bicycle.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // ------------------------------------------------------------------ checks
  const checks = [];
  const add = (ok, label, detail) => checks.push({ ok, label, detail });

  const hubDy = Math.abs(GEO.hubs[0][1] - GEO.hubs[1][1]);
  add(hubDy < 0.5, '两个轮子同高',
      `轴心 y = ${GEO.hubs[0][1]}，差值 ${hubDy.toFixed(2)}px`);

  const contact = GEO.hubs.map(h => h[1] + GEO.wheelR);
  add(contact.every(y => Math.abs(y - GEO.ground) < 0.5), '轮胎着地',
      `胎底 y = ${contact[0]}，地面 y = ${GEO.ground}`);

  [GEO.far, GEO.near].forEach((ph, i) => {
    const p = pedal(ph.deg);
    const ankle = [p[0] + ph.ankleDx, p[1] + ph.ankleDy];
    const knee = ik(ph.hip, ankle, GEO.thigh, GEO.shin);
    const thigh = Math.hypot(knee[0] - ph.hip[0], knee[1] - ph.hip[1]);
    const shin = Math.hypot(ankle[0] - knee[0], ankle[1] - knee[1]);
    const span = Math.hypot(ankle[0] - ph.hip[0], ankle[1] - ph.hip[1]);
    add(Math.abs(thigh - GEO.thigh) < 0.5 && Math.abs(shin - GEO.shin) < 0.5 &&
        span < GEO.thigh + GEO.shin,
        `腿（${i === 0 ? '远侧' : '近侧'}）踩得到踏板`,
        `大腿 ${thigh.toFixed(1)}px，小腿 ${shin.toFixed(1)}px，髋→踝 ${span.toFixed(1)}px ` +
        `（够得着，还差 ${(GEO.thigh + GEO.shin - span).toFixed(1)}px 弯曲量）`);
  });

  const feet = [pedal(GEO.far.deg), pedal(GEO.near.deg)];
  add(feet.every(p => Math.abs(p[1] - GEO.bb[1]) <= GEO.crankR + 0.5 &&
                      Math.abs(Math.hypot(p[0] - GEO.bb[0], p[1] - GEO.bb[1]) - GEO.crankR) < 0.5),
      '两只脚都踩在曲柄圆上',
      feet.map(p => `(${p[0].toFixed(0)}, ${p[1].toFixed(0)})`).join(' / '));

  const gripDist = Math.hypot(GEO.grip[0] - GEO.shoulder[0], GEO.grip[1] - GEO.shoulder[1]);
  add(gripDist < 140, '翅膀够得着车把', `肩→握把 ${gripDist.toFixed(1)}px`);

  const seatGap = Math.hypot(GEO.near.hip[0] - 344, GEO.near.hip[1] - 336);
  add(seatGap < 40, '屁股在车座上方', `髋关节距座垫中心 ${seatGap.toFixed(1)}px`);

  const passed = checks.filter(c => c.ok).length;
  document.getElementById('score').innerHTML = `空间检查 <b>${passed}/${checks.length}</b>`;
  document.getElementById('checks').innerHTML = checks.map(c =>
    `<li><span class="mark">${c.ok ? '✓' : '✗'}</span>
      <span><strong>${c.label}</strong><br>
      <span style="color:#6b6459;font-size:13px">${c.detail}</span></span></li>`).join('');
})();
</script>
</body>
</html>
"""


def main() -> None:
    svg = scene()
    (OUT / "pelican.svg").write_text(svg, encoding="utf-8")
    page = (
        PAGE.replace("__SVG__", svg)
        .replace("__NEAR_DEG__", f(NEAR_CRANK_DEG))
        .replace("__FAR_DEG__", f(FAR_CRANK_DEG))
        .replace("__GROUND__", f(GROUND))
        .replace("__GRIP_X__", f(BAR_GRIP[0]))
        .replace("__GRIP_Y__", f(BAR_GRIP[1]))
        .replace("__HIP_NX__", f(HIP_NEAR[0]))
        .replace("__HIP_NY__", f(HIP_NEAR[1]))
        .replace("__HIP_FX__", f(HIP_FAR[0]))
        .replace("__HIP_FY__", f(HIP_FAR[1]))
        .replace("__RH_X__", f(REAR_HUB[0]))
        .replace("__RH_Y__", f(REAR_HUB[1]))
        .replace("__FH_X__", f(FRONT_HUB[0]))
        .replace("__FH_Y__", f(FRONT_HUB[1]))
    )
    (OUT / "index.html").write_text(page, encoding="utf-8")
    print(f"wrote {OUT/'pelican.svg'} and {OUT/'index.html'}")


if __name__ == "__main__":
    main()
