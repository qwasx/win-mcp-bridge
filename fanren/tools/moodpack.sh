#!/bin/bash
cd /home/user/sandbox
T=/tmp/work/tex/mood_textures_all; O=src/assets/mood; mkdir -p $O
mk(){ local in="$T/$1.png" out="$O/$2.webp"; convert "$in" -crop "$3" +repage -alpha off \( +clone -fx "$4" \) -alpha set -compose CopyOpacity -composite -resize "$5" -quality 88 "$out" && echo "ok $2 $(identify -format '%wx%h' "$out")"; }
FAR='min(max(0,min(1,(hypot(hypot(r-0.914,g-0.875),b-0.776)-0.06)*3)),max(0,min(1,(1-j/h)/0.35)))'
CHR='max(0,min(1,(max(r,max(g,b))-min(r,min(g,b))-0.04)*5))'
MOON='max(0,min(1,(r+g+b)/3*1.6-0.05))'
MIST='max(0,min(1,(0.93-(r+g+b)/3)/0.45*1.6))'
INK='max(0,min(1,(0.78-(r+g+b)/3)/0.45))'
RAIN='max(0,min(1,(0.86-(r+g+b)/3)/0.4))*0.55'
CLOUD='max(0,min(1,(0.93-(r+g+b)/3)/0.35))*0.6'
mk moon_full moon_full 1024x1024+0+0 "$MOON" 512x512\>
mk moon_crescent moon_crescent 1024x1024+0+0 "$MOON" 512x512\>
mk wild_geese wild_geese 2064x512+0+0 "$INK" 1024x1024\>
mk rain_veil rain_veil 1024x1024+0+0 "$RAIN" 1024x1024\>
mk mist_puff_1 mist_puff_1 1024x1024+0+0 "$MIST" 512x512\>
mk mist_puff_2 mist_puff_2 1024x1024+0+0 "$MIST" 512x512\>
mk mist_band_1 mist_band_1 2064x512+0+0 "$MIST" 1024x1024\>
mk mist_band_2 mist_band_2 2064x512+0+0 "$MIST" 1024x1024\>
mk far_mtn_1 far_mtn_1 2352x322+0+0 "$FAR" 2048x2048\>
mk far_mtn_2 far_mtn_2 2048x368+0+0 "$FAR" 2048x2048\>
mk far_mtn_3 far_mtn_3 1856x414+0+0 "$FAR" 2048x2048\>
mk sky_dawn_mist sky_dawn_mist 2480x432+0+0 "$CHR" 2048x2048\>
mk sky_dusk_glow sky_dusk_glow 2480x432+0+0 "$CHR" 2048x2048\>
mk sky_cloud_band sky_cloud_band 2704x384+0+0 "$CLOUD" 2048x2048\>
echo ALL_DONE
