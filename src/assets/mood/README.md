# Mood texture set

These 23 textures come from the supplied `mood_textures_all_23` draft set.
They were normalized to the art brief's target dimensions and converted from
baked RGB/checkerboard previews to real, non-premultiplied RGBA where needed.

Runtime integration lives in `src/world/mood.ts`, with lake-specific placement
in `src/world/scenery.ts` and final composition in `src/world/render.ts`.