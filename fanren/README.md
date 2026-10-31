# Fanren: Mountains With Breath

A complete React + Vite version of the supplied v0.46 cultivation game, with the original simulation, combat, characters, maps and save keys preserved. The root entry is `src/App.tsx`.

## Run

- Node.js 20.19+ or 22.12+ is required.
- Run `npm install` and `npm run dev -- --host 0.0.0.0`.
- Run `npm run build`, then `npm run preview -- --host 0.0.0.0` to test production output.
- Serve the whole `dist/` directory, including `art/`, `mood/`, and `game-assets/`. This release uses external art URLs to keep builds within 2 GB RAM. Opening only `dist/index.html` through `file://` is not supported.

## Code-Only Distribution

The source-only GitHub delivery deliberately excludes existing image and audio binaries. It does not upload the supplied mood pack again.

1. Install Python 3.10+ and run `python -m pip install pillow numpy scipy`.
2. Run `python tools/restore-assets.py` from the project root. It downloads the two original release archives provided by the owner and reconstructs public art, game assets and all 23 straight-alpha overlays.
3. Run `npm install` followed by `npm run dev`.

The working web preview includes a new title-screen landscape. The source-only restoration uses the original game's title art as a fallback; this does not affect the in-game mood renderer.

## Features

- Three horizontally seamless mountain scrolls with 0.05 / 0.12 / 0.22 parallax.
- Continuous time/weather soft-light color grading in Canvas2D and the existing WebGL post shader.
- True-alpha mist, cloud bands, dawn and dusk washes, lunar phases, clear-night stars and a second rain veil.
- Reduced and culled lake mist pool, seasonal lotus and plum, distant sails, reeds, fishing lights and roof smoke.
- Slow cached cloud shadows, quiet-camera mist after ten seconds outside combat, and sparse synthesized ambience accents.
- Responsive animated title screen with four selectable moods, guide, sound, fullscreen and settings.
- In-game photo mode with four actual-world camera presets and downloadable PNGs. Exiting restores the camera, calendar, weather and exploration flags without moving the player or altering saves.

## Verification

- `npx tsc --noEmit`
- `npx tsx tools/test-mood.ts`
- `python tools/verify-mood.py`
- `node tools/mood-smoke.mjs` with the dev server running on port 5173.
- `TEST_URL=http://localhost:4173 node tools/compat-smoke.mjs` for production Canvas2D fallback.
- `node tools/gpubench.mjs --port=5173 --frames=60` for a paired warm-cache mood-on/mood-off comparison.

Verification artifacts are written to `.downloads/verification/`. The GPU benchmark explicitly reports its software-rendering environment; it is not a certification of physical-GPU performance. Visual wallpaper suitability remains an art-direction review, not an automated pass.
The checked-in JSON reports are under `docs/art-brief/verification/`.

This is a non-commercial fan work. The original characters and setting belong to their respective rights holders.