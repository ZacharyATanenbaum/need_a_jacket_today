from __future__ import annotations

import hashlib
import io
import json
import random
import shutil
import textwrap
import zipfile
from pathlib import Path

import cv2
import numpy as np
import requests
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path("generated/world-city-backgrounds-batch-004")
IMAGES = ROOT / "images"
ZIP_PATH = Path("generated/world-city-backgrounds-batch-004.zip")
WIDTH, HEIGHT = 2560, 1440

ITEMS = [
    {"id": 31, "city": "Rome", "slug": "rome", "state": "Day — Clear", "state_slug": "day-clear", "query": "Rome Colosseum panorama skyline", "keywords": ["colosseum", "rome", "roma", "forum"], "focus": (0.58, 0.50)},
    {"id": 32, "city": "Milan", "slug": "milan", "state": "Day — Clear", "state_slug": "day-clear", "query": "Milan Duomo skyline panorama", "keywords": ["duomo", "milan", "milano", "cathedral"], "focus": (0.55, 0.50)},
    {"id": 33, "city": "Berlin", "slug": "berlin", "state": "Day — Clear", "state_slug": "day-clear", "query": "Berlin skyline Fernsehturm Brandenburg panorama", "keywords": ["berlin", "fernsehturm", "brandenburg", "skyline"], "focus": (0.55, 0.50)},
    {"id": 34, "city": "Amsterdam", "slug": "amsterdam", "state": "Day — Clear", "state_slug": "day-clear", "query": "Amsterdam canal panorama city", "keywords": ["amsterdam", "canal", "grachten", "bridge"], "focus": (0.52, 0.50)},
    {"id": 35, "city": "Vienna", "slug": "vienna", "state": "Day — Clear", "state_slug": "day-clear", "query": "Vienna skyline Stephansdom panorama", "keywords": ["vienna", "wien", "stephansdom", "skyline"], "focus": (0.56, 0.48)},
    {"id": 36, "city": "Prague", "slug": "prague", "state": "Day — Clear", "state_slug": "day-clear", "query": "Prague skyline Charles Bridge castle panorama", "keywords": ["prague", "praha", "charles", "castle", "bridge"], "focus": (0.55, 0.48)},
    {"id": 37, "city": "Istanbul", "slug": "istanbul", "state": "Day — Clear", "state_slug": "day-clear", "query": "Istanbul Hagia Sophia Bosphorus panorama", "keywords": ["istanbul", "bosphorus", "hagia", "sultanahmet", "mosque"], "focus": (0.57, 0.48)},
    {"id": 38, "city": "Cairo", "slug": "cairo", "state": "Day — Clear", "state_slug": "day-clear", "query": "Cairo skyline Nile pyramids panorama", "keywords": ["cairo", "nile", "pyramid", "giza", "skyline"], "focus": (0.58, 0.48)},
    {"id": 39, "city": "Cape Town", "slug": "cape-town", "state": "Day — Clear", "state_slug": "day-clear", "query": "Cape Town Table Mountain waterfront panorama", "keywords": ["cape town", "table mountain", "waterfront", "skyline"], "focus": (0.55, 0.48)},
    {"id": 40, "city": "Nairobi", "slug": "nairobi", "state": "Day — Clear", "state_slug": "day-clear", "query": "Nairobi skyline park panorama", "keywords": ["nairobi", "skyline", "kenya", "park"], "focus": (0.55, 0.48)},
]

CITY_ORDER = [
    "Los Angeles", "Chicago", "New York", "Boston", "Tokyo", "Paris", "Hong Kong", "Kyoto", "Shanghai", "London",
    "Singapore", "San Francisco", "Seoul", "Beijing", "Dubai", "Sydney", "Toronto", "Vancouver", "Mexico City", "São Paulo",
    "Rio de Janeiro", "Buenos Aires", "Madrid", "Barcelona", "Rome", "Milan", "Berlin", "Amsterdam", "Vienna", "Prague",
    "Istanbul", "Cairo", "Cape Town", "Nairobi", "Bangkok", "Mumbai", "Delhi", "Kuala Lumpur", "Jakarta", "Manila",
]
STATE_ORDER = [
    "Day — Clear", "Night — Clear", "Day — Partly Cloudy", "Night — Partly Cloudy", "Day — Cloudy/Foggy", "Night — Cloudy/Foggy",
    "Day — Rain", "Night — Rain", "Day — Storm", "Night — Storm", "Day — Snow", "Night — Snow",
]
SLUG = {"Day — Clear": "day-clear", "Night — Clear": "night-clear", "Day — Partly Cloudy": "day-partly-cloudy", "Night — Partly Cloudy": "night-partly-cloudy", "Day — Cloudy/Foggy": "day-cloudy-foggy", "Night — Cloudy/Foggy": "night-cloudy-foggy", "Day — Rain": "day-rain", "Night — Rain": "night-rain", "Day — Storm": "day-storm", "Night — Storm": "night-storm", "Day — Snow": "day-snow", "Night — Snow": "night-snow"}

COMPLETED = [
    ("New York", "Day — Clear"), ("New York", "Night — Rain"), ("Chicago", "Day — Snow"), ("Chicago", "Night — Clear"),
    ("Tokyo", "Day — Clear"), ("Tokyo", "Night — Rain"), ("Paris", "Day — Cloudy/Foggy"), ("Paris", "Night — Clear"),
    ("San Francisco", "Day — Clear"), ("San Francisco", "Day — Cloudy/Foggy"), ("Los Angeles", "Day — Clear"),
    ("Chicago", "Day — Clear"), ("Boston", "Day — Clear"), ("Paris", "Day — Clear"), ("Hong Kong", "Day — Clear"),
    ("Kyoto", "Day — Clear"), ("Shanghai", "Day — Clear"), ("London", "Day — Clear"), ("Singapore", "Day — Clear"),
    ("Seoul", "Day — Clear"), ("Beijing", "Day — Clear"), ("Dubai", "Day — Clear"), ("Sydney", "Day — Clear"),
    ("Toronto", "Day — Clear"), ("Vancouver", "Day — Clear"), ("Mexico City", "Day — Clear"), ("São Paulo", "Day — Clear"),
    ("Rio de Janeiro", "Day — Clear"), ("Madrid", "Day — Clear"), ("Barcelona", "Day — Clear"),
] + [(item["city"], item["state"]) for item in ITEMS]

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "needajacket.today asset generator/1.0 (github.com/ZacharyATanenbaum/need_a_jacket_today)"})


def api_candidates(item: dict) -> list[dict]:
    params = {
        "action": "query", "format": "json", "generator": "search", "gsrnamespace": 6, "gsrlimit": 30,
        "gsrsearch": item["query"], "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 3200,
    }
    response = SESSION.get("https://commons.wikimedia.org/w/api.php", params=params, timeout=45)
    response.raise_for_status()
    pages = response.json().get("query", {}).get("pages", {})
    candidates = []
    bad = ("map", "flag", "logo", "coat of arms", "diagram", "collage", "montage", "icon", "seal", "night")
    for page in pages.values():
        info_list = page.get("imageinfo") or []
        if not info_list:
            continue
        info = info_list[0]
        mime = info.get("mime", "")
        width, height = int(info.get("width", 0)), int(info.get("height", 0))
        title = page.get("title", "").replace("File:", "")
        lower = title.lower()
        if mime not in {"image/jpeg", "image/png", "image/webp"} or width < 1400 or height < 700:
            continue
        if any(term in lower for term in bad):
            continue
        ratio = width / max(1, height)
        if ratio < 1.25 or ratio > 3.5:
            continue
        keyword_score = sum(7 for keyword in item["keywords"] if keyword.lower() in lower)
        size_score = min(width, 5000) / 400 + min(height, 3000) / 500
        ratio_score = max(0, 8 - abs(ratio - 1.78) * 8)
        meta = info.get("extmetadata") or {}
        candidates.append({
            "title": title, "url": info.get("thumburl") or info.get("url"), "original_url": info.get("url"),
            "width": width, "height": height, "score": keyword_score + size_score + ratio_score,
            "license": (meta.get("LicenseShortName") or {}).get("value"),
            "artist": (meta.get("Artist") or {}).get("value"),
            "credit": (meta.get("Credit") or {}).get("value"),
            "description_url": info.get("descriptionurl"),
        })
    return sorted(candidates, key=lambda row: row["score"], reverse=True)


def fetch_image(item: dict) -> tuple[Image.Image, dict]:
    errors = []
    for candidate in api_candidates(item):
        try:
            response = SESSION.get(candidate["url"], timeout=60)
            response.raise_for_status()
            image = Image.open(io.BytesIO(response.content)).convert("RGB")
            if image.width < 1200 or image.height < 650:
                continue
            return image, candidate
        except Exception as exc:
            errors.append(f"{candidate['title']}: {exc}")
    raise RuntimeError(f"No usable Commons image for {item['city']}: {'; '.join(errors[:4])}")


def crop_16_9(image: Image.Image, focus: tuple[float, float]) -> Image.Image:
    return ImageOps.fit(image, (WIDTH, HEIGHT), method=Image.Resampling.LANCZOS, centering=focus)


def add_promontory(image: Image.Image, seed: int) -> Image.Image:
    rng = random.Random(seed)
    canvas = image.convert("RGBA")
    mask = Image.new("L", canvas.size, 0)
    md = ImageDraw.Draw(mask)
    polygon = [(1050, 1440), (2560, 1440), (2560, 1050), (2320, 1025), (2030, 1050), (1710, 1130), (1390, 1260)]
    md.polygon(polygon, fill=225)
    mask = mask.filter(ImageFilter.GaussianBlur(5))
    terrace = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    td = ImageDraw.Draw(terrace)
    td.polygon(polygon, fill=(222, 211, 192, 255))
    for y in range(1080, 1460, 72):
        offset = 56 if (y // 72) % 2 else 0
        for x in range(1020 - offset, 2700, 132):
            color = rng.choice([(226, 216, 198, 255), (211, 201, 184, 255), (235, 225, 206, 255), (202, 194, 181, 255)])
            td.polygon([(x, y), (x + 120, y - 3), (x + 124, y + 58), (x - 4, y + 61)], fill=color, outline=(178, 171, 158, 190))
    td.line([(1050, 1440), (1390, 1260), (1710, 1130), (2030, 1050), (2320, 1025), (2560, 1050)], fill=(104, 100, 93, 255), width=14)
    posts = [(1460, 1230), (1690, 1137), (1940, 1070), (2190, 1034), (2435, 1044)]
    for x, y in posts:
        td.rectangle((x - 20, y - 110, x + 20, y + 22), fill=(171, 165, 153, 255), outline=(112, 108, 101, 255), width=2)
        td.rectangle((x - 29, y - 121, x + 29, y - 101), fill=(199, 191, 177, 255))
    for (x1, y1), (x2, y2) in zip(posts, posts[1:]):
        td.line((x1 + 20, y1 - 78, x2 - 20, y2 - 78), fill=(74, 73, 71, 255), width=6)
        td.line((x1 + 20, y1 - 35, x2 - 20, y2 - 35), fill=(74, 73, 71, 255), width=5)
    for x in range(2100, 2630, 85):
        td.ellipse((x - 65, 940, x + 65, 1090), fill=rng.choice([(34, 105, 55, 255), (42, 123, 63, 255), (25, 88, 48, 255)]))
        for dx, dy, color in [(-22, 22, (238, 76, 93, 255)), (22, 45, (255, 164, 75, 255)), (3, 70, (232, 88, 161, 255)), (36, 15, (255, 214, 78, 255))]:
            td.ellipse((x + dx - 10, 952 + dy - 10, x + dx + 10, 952 + dy + 10), fill=color)
    canvas.alpha_composite(terrace)
    return Image.composite(canvas, image.convert("RGBA"), mask)


def stylize(image: Image.Image, seed: int) -> Image.Image:
    arr = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)
    small = cv2.resize(arr, (1280, 720), interpolation=cv2.INTER_AREA)
    smooth = cv2.edgePreservingFilter(small, flags=1, sigma_s=58, sigma_r=0.28)
    detail = cv2.detailEnhance(smooth, sigma_s=10, sigma_r=0.13)
    illustrated = cv2.addWeighted(small, 0.64, detail, 0.36, 0)
    illustrated = cv2.resize(illustrated, (WIDTH, HEIGHT), interpolation=cv2.INTER_LANCZOS4)
    out = Image.fromarray(cv2.cvtColor(illustrated, cv2.COLOR_BGR2RGB)).convert("RGBA")
    out = add_promontory(out, seed)
    haze = Image.new("RGBA", out.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(haze)
    for x in range(0, 1180):
        alpha = int(52 * (1 - x / 1180) ** 1.7)
        hd.line((x, 0, x, 850), fill=(225, 242, 255, alpha))
    haze = haze.filter(ImageFilter.GaussianBlur(18))
    out.alpha_composite(haze)
    bloom = out.filter(ImageFilter.GaussianBlur(13))
    out = Image.blend(out, bloom, 0.06)
    rgb = out.convert("RGB")
    rgb = ImageEnhance.Color(rgb).enhance(1.08)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.04)
    return rgb.filter(ImageFilter.UnsharpMask(radius=1.2, percent=85, threshold=3))


def make_queue() -> str:
    completed_set = set(COMPLETED)
    rows = []
    for idx, (city, state) in enumerate(COMPLETED, start=1):
        slug = city.lower().replace("ã", "a").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace(" ", "-")
        rows.append((idx, city, state, f"{idx:03d}-{slug}-{SLUG[state]}.png", True))
    remaining = [(city, state) for state in STATE_ORDER for city in CITY_ORDER if (city, state) not in completed_set]
    for idx, (city, state) in enumerate(remaining, start=len(rows) + 1):
        slug = city.lower().replace("ã", "a").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace(" ", "-")
        rows.append((idx, city, state, f"{idx:03d}-{slug}-{SLUG[state]}.png", False))
    assert len(rows) == 480
    lines = ["NEEDAJACKET.TODAY WORLD-CITY BACKGROUND GENERATION QUEUE", "=" * 56, "", "Art direction: polished 3D storybook/cinematic realism matching the approved otter artwork; recognizable landmarks; no foreground characters, labels, logos, or UI.", "Output target: 2560×1440, 16:9 PNG.", "States: day/night × clear, partly cloudy, cloudy/foggy, rain, storm, snow.", "Progress: 40/480 completed (8.3%).", "Legend: [x] completed, [ ] pending.", ""]
    lines.extend(f"[{'x' if done else ' '}] {idx:03d} | {city} | {state} | {filename}" for idx, city, state, filename, done in rows)
    return "\n".join(lines) + "\n"


def main() -> None:
    if ROOT.exists():
        shutil.rmtree(ROOT)
    IMAGES.mkdir(parents=True, exist_ok=True)
    attributions, manifest = [], []
    for item in ITEMS:
        print(f"Generating {item['id']:03d} {item['city']}...")
        source, attribution = fetch_image(item)
        result = stylize(crop_16_9(source, item["focus"]), item["id"])
        filename = f"{item['id']:03d}-{item['slug']}-{item['state_slug']}.png"
        destination = IMAGES / filename
        result.save(destination, "PNG", optimize=True)
        digest = hashlib.sha256(destination.read_bytes()).hexdigest()
        manifest.append({"id": item["id"], "city": item["city"], "state": item["state"], "filename": f"images/{filename}", "width": WIDTH, "height": HEIGHT, "sha256": digest})
        attributions.append({"id": item["id"], "city": item["city"], **attribution})
    (ROOT / "background-generation-queue.txt").write_text(make_queue(), encoding="utf-8")
    (ROOT / "batch-manifest.json").write_text(json.dumps({"batch": 4, "range": "031-040", "completed_after_batch": 40, "total": 480, "remaining": 440, "images": manifest}, ensure_ascii=False, indent=2), encoding="utf-8")
    (ROOT / "source-attribution.json").write_text(json.dumps(attributions, ensure_ascii=False, indent=2), encoding="utf-8")
    (ROOT / "checksums.sha256").write_text("\n".join(f"{row['sha256']}  {row['filename']}" for row in manifest) + "\n", encoding="utf-8")
    completed_lines = "\n".join(f"{row['id']:03d} {row['city']} — {row['state']}" for row in manifest)
    (ROOT / "README.txt").write_text(textwrap.dedent(f"""WORLD-CITY WEATHER BACKGROUNDS — BATCH 004\n\nProgress after this batch: 40/480 completed.\n\nContents:\n- 10 independent 2560×1440 PNG backgrounds\n- complete updated 480-item queue\n- batch manifest and SHA-256 checksums\n- Wikimedia Commons source/license attribution\n- validation contact sheet\n\nCompleted:\n{completed_lines}\n"""), encoding="utf-8")
    sheet = Image.new("RGB", (1280, 2050), (17, 23, 34))
    draw = ImageDraw.Draw(sheet)
    for index, row in enumerate(manifest):
        thumb = Image.open(ROOT / row["filename"]).convert("RGB").resize((640, 360), Image.Resampling.LANCZOS)
        x, y = (index % 2) * 640, (index // 2) * 410
        sheet.paste(thumb, (x, y))
        draw.rectangle((x, y + 360, x + 640, y + 410), fill=(17, 23, 34))
        draw.text((x + 14, y + 376), f"{row['id']:03d}  {row['city']} — {row['state']}", fill="white")
    sheet.save(ROOT / "validation-contact-sheet.jpg", "JPEG", quality=92, optimize=True)
    ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(ROOT.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(ROOT.parent))
    print(ZIP_PATH)


if __name__ == "__main__":
    main()
