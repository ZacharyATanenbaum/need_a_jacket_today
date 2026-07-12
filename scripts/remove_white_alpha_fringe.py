#!/usr/bin/env python3
"""Remove low-alpha white matte pixels from transparent WebP cutouts."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageFilter


def clean(path: Path) -> tuple[int, int]:
    image = Image.open(path).convert("RGBA")
    pixels = bytearray(image.tobytes())
    alpha = image.getchannel("A")
    transparent = alpha.point(lambda value: 255 if value == 0 else 0)
    edge = transparent.filter(ImageFilter.MaxFilter(3)).tobytes()
    near_transparent = transparent.filter(ImageFilter.MaxFilter(7)).tobytes()
    removed = 0
    unmatted = 0
    shadow_cutoff = round(image.height * 0.88)

    for offset in range(0, len(pixels), 4):
        red, green, blue, alpha = pixels[offset : offset + 4]
        row = (offset // 4) // image.width
        if alpha == 0:
            continue

        # Contract the alpha mask by one source pixel. At 1024px this is
        # visually negligible, but it removes the final bright antialiased
        # row inherited from the source sheet.
        if edge[offset // 4]:
            pixels[offset : offset + 4] = bytes((0, 0, 0, 0))
            removed += 1
            continue

        # The generated sheets include a pale studio floor ellipse beneath
        # each character. It reads as loose white pixels once composited over
        # a photographic weather scene, so remove only that bottom neutral.
        if row >= shadow_cutoff and min(red, green, blue) > 150 and max(red, green, blue) - min(red, green, blue) < 45:
            pixels[offset : offset + 4] = bytes((0, 0, 0, 0))
            removed += 1
            continue

        # Remove the thin neutral-white outline baked into the cutout, but
        # only where it touches the transparent exterior. Interior whites
        # such as eyes, fur highlights, and raindrops remain untouched.
        if near_transparent[offset // 4] and min(red, green, blue) > 210 and max(red, green, blue) - min(red, green, blue) < 35:
            pixels[offset : offset + 4] = bytes((0, 0, 0, 0))
            removed += 1
            continue

        if alpha == 255:
            continue

        # The source cutouts contain thousands of nearly white, low-opacity
        # pixels outside the subject. They become visible as a white fringe on
        # dark weather backgrounds and are not part of the otter artwork.
        if alpha < 220 and min(red, green, blue) > 235:
            pixels[offset : offset + 4] = bytes((0, 0, 0, 0))
            removed += 1
            continue

        # Remove the remaining white matte contribution while retaining the
        # existing alpha coverage and all fully opaque source pixels.
        for channel in range(3):
            value = pixels[offset + channel]
            value = 255 + round((value - 255) * 255 / alpha)
            pixels[offset + channel] = max(0, min(255, value))
        unmatted += 1

    cleaned = Image.frombytes("RGBA", image.size, bytes(pixels))
    cleaned.save(path, "WEBP", lossless=True, method=6, exact=True)
    return removed, unmatted


def update_manifest(directory: Path) -> None:
    manifest_path = directory / "manifest.json"
    if not manifest_path.is_file():
        return

    manifest = json.loads(manifest_path.read_text())
    states = {state["file"]: state for state in manifest.get("states", [])}
    for path in directory.glob("*.webp"):
        state = states.get(path.name)
        if state is None:
            continue
        data = path.read_bytes()
        image = Image.open(path).convert("RGBA")
        alpha = image.getchannel("A")
        state["bytes"] = len(data)
        state["sha256"] = hashlib.sha256(data).hexdigest()
        state["alpha_bbox"] = list(alpha.getbbox() or (0, 0, 0, 0))
        state["subject_coverage"] = round(
            sum(1 for value in alpha.getdata() if value) / (image.width * image.height), 4
        )

    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path)
    args = parser.parse_args()

    directories: set[Path] = set()
    for path in args.paths:
        removed, unmatted = clean(path)
        directories.add(path.parent)
        print(f"{path}: removed={removed} unmatted={unmatted}")
    for directory in directories:
        update_manifest(directory)


if __name__ == "__main__":
    main()
