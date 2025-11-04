#!/usr/bin/env bash
# Arch: sudo pacman -S imagemagick libwebp

set -euo pipefail
shopt -s nullglob

mkdir -p webp
for f in pngs/*.png; do
  base="$(basename "$f" .png)"

  magick "$f" -alpha on -trim +repage -gravity center -background none -extent 1024x1024 \
    \( -clone 0 -resize 256x256 -quality 80 -define webp:alpha-quality=80 -write "webp/${base}-256.webp" +delete \) \
    \( -clone 0 -resize 512x512 -quality 80 -define webp:alpha-quality=80 -write "webp/${base}-512.webp" +delete \) \
    null:
done

