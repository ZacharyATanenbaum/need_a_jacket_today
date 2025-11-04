#!/usr/bin/env bash
# Install (Arch): sudo pacman -S --needed imagemagick libwebp
# If IM v6 only: replace 'magick' with 'convert' below.

set -euo pipefail
shopt -s nullglob

in_dir="pngs"
out_dir="webp"
mkdir -p "$out_dir"

for f in "$in_dir"/*.png; do
  base="$(basename "$f" .png)"

  # 256px (centered on a square, no intermediates)
  magick "$f" -auto-orient -alpha on \
    -fuzz 5% -trim +repage \
    -resize "1024x1024>" \
    -gravity center -background none -extent 1024x1024 \
    -resize 256x256 \
    -quality 82 -define webp:alpha-quality=82 \
    "$out_dir/${base}-256.webp"

  # 512px
  magick "$f" -auto-orient -alpha on \
    -fuzz 5% -trim +repage \
    -resize "1024x1024>" \
    -gravity center -background none -extent 1024x1024 \
    -resize 512x512 \
    -quality 82 -define webp:alpha-quality=82 \
    "$out_dir/${base}-512.webp"
done

