#!/usr/bin/env bash
# Install (pick your OS)
# Arch:   sudo pacman -S --needed libwebp imagemagick
# Ubuntu: sudo apt-get install -y webp imagemagick
# Fedora: sudo dnf install -y libwebp-tools ImageMagick
# Alpine: sudo apk add libwebp-tools imagemagick
# macOS:  brew install webp imagemagick

set -euo pipefail
shopt -s nullglob

in_dir="pngs"
out_dir="webp"
mkdir -p "$out_dir"

# config via env: QUALITY=0..100 (default 80), LOSSLESS=1 for lossless
quality="${QUALITY:-80}"
lossless="${LOSSLESS:-0}"

# pick ImageMagick binary if needed
IM="magick"; command -v magick >/dev/null 2>&1 || IM="convert"
has_cwebp=0; command -v cwebp >/dev/null 2>&1 && has_cwebp=1
has_im_webp=0; $IM -list format 2>/dev/null | grep -qi '^ *WEBP' && has_im_webp=1

if [[ $has_cwebp -eq 0 && $has_im_webp -eq 0 ]]; then
  echo "No WebP encoder found. Install 'libwebp' (for cwebp) or ImageMagick with WebP support."
  exit 1
fi

for f in "$in_dir"/*.png; do
  base="$(basename "$f" .png)"
  if [[ $has_cwebp -eq 1 ]]; then
    if [[ "$lossless" == "1" ]]; then
      cwebp -lossless -exact -mt "$f" -o "$out_dir/${base}.webp"
    else
      cwebp -q "$quality" -m 6 -mt -af "$f" -o "$out_dir/${base}.webp"
    fi
  else
    if [[ "$lossless" == "1" ]]; then
      "$IM" "$f" -define webp:lossless=true "$out_dir/${base}.webp"
    else
      "$IM" "$f" -quality "$quality" -define webp:alpha-quality="$quality" "$out_dir/${base}.webp"
    fi
  fi
done

