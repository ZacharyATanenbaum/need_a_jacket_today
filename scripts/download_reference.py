#!/usr/bin/env python3
"""Download and validate an image reference from a signed attachment URL."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def image_kind(data: bytes) -> str | None:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith((b"\xff\xd8\xff",)):
        return "jpeg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "gif"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "webp"
    if data.lstrip().startswith(b"<svg"):
        return "svg"
    return None


def firefox_cookie(profile: Path) -> str | None:
    database = profile / "cookies.sqlite"
    if not database.is_file():
        raise ValueError(f"Firefox cookie database not found in {profile}")

    with tempfile.TemporaryDirectory() as temporary_directory:
        snapshot = Path(temporary_directory) / "cookies.sqlite"
        source = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
        target = sqlite3.connect(snapshot)
        source.backup(target)
        source.close()
        target.close()

        connection = sqlite3.connect(snapshot)
        rows = connection.execute(
            """
            SELECT name, value
            FROM moz_cookies
            WHERE (host = 'chatgpt.com' OR host LIKE '%.chatgpt.com')
              AND expiry > unixepoch()
            """
        ).fetchall()
        connection.close()

    return "; ".join(f"{name}={value}" for name, value in rows) or None


def download(url: str, destination: Path, firefox_profile: Path | None = None) -> None:
    headers = {
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Referer": "https://chatgpt.com/",
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
        ),
    }
    cookie = os.environ.get("CHATGPT_COOKIE")
    if not cookie and firefox_profile:
        cookie = firefox_cookie(firefox_profile)
    if cookie:
        headers["Cookie"] = cookie

    request = Request(url, headers=headers)
    with urlopen(request, timeout=30) as response:
        data = response.read()
        content_type = response.headers.get_content_type()

    kind = image_kind(data)
    if not content_type.startswith("image/") or kind is None:
        raise ValueError(
            f"attachment was not an image (content-type={content_type!r})"
        )

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    print(f"Downloaded {kind} image ({len(data)} bytes) to {destination}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="signed attachment URL")
    parser.add_argument("destination", type=Path, help="output image path")
    parser.add_argument(
        "--firefox-profile",
        type=Path,
        help="Firefox profile whose chatgpt.com session should authenticate the request",
    )
    args = parser.parse_args()

    try:
        download(args.url, args.destination, args.firefox_profile)
    except (HTTPError, URLError, ValueError, OSError) as error:
        print(f"Download failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
