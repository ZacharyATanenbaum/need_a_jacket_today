#!/usr/bin/env python3
"""Download and validate a design reference from a signed attachment URL."""

from __future__ import annotations

import argparse
import base64
from io import BytesIO
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import zipfile
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
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


def validate_zip(data: bytes) -> None:
    if not zipfile.is_zipfile(BytesIO(data)):
        raise ValueError("downloaded archive is not a valid ZIP file")
    with zipfile.ZipFile(BytesIO(data)) as archive:
        files = [entry for entry in archive.infolist() if not entry.is_dir()]
        if not files:
            raise ValueError("downloaded ZIP file is empty")
        for entry in files:
            path = Path(entry.filename)
            if path.is_absolute() or ".." in path.parts:
                raise ValueError("downloaded ZIP contains an unsafe path")
        damaged = archive.testzip()
        if damaged:
            raise ValueError(f"downloaded ZIP contains a damaged file: {damaged}")


def download_proton_reference(url: str) -> tuple[bytes, str]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as error:
        raise ValueError(
            "Playwright is required for Proton Drive shares; install it and its "
            "Chromium browser first"
        ) from error

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 1200})
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=45_000)
            image = page.locator("img[src^='blob:']").first
            download_button = page.locator(
                "button[data-testid='dropdown-download-button']"
            ).first
            page.locator(
                "img[src^='blob:'], button[data-testid='dropdown-download-button']"
            ).first.wait_for(state="visible", timeout=45_000)
            if image.is_visible():
                payload = image.evaluate(
                    """async image => {
                        const response = await fetch(image.src);
                        const bytes = new Uint8Array(await response.arrayBuffer());
                        let binary = '';
                        const chunkSize = 0x8000;
                        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
                            binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
                        }
                        return {data: btoa(binary), contentType: response.headers.get('content-type') || ''};
                    }"""
                )
                return base64.b64decode(payload["data"]), payload["contentType"]
            download_button.click()
            file_download_button = page.locator(
                "button[data-testid='download-button']"
            ).first
            file_download_button.wait_for(state="visible", timeout=10_000)
            with page.expect_download(timeout=120_000) as download_info:
                file_download_button.click()
            download = download_info.value
            downloaded_path = download.path()
            if downloaded_path is None:
                raise ValueError("Proton download did not produce a local file")
            return Path(downloaded_path).read_bytes(), "application/zip"
        finally:
            browser.close()


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

    if urlparse(url).hostname == "drive.proton.me":
        data, content_type = download_proton_reference(url)
    else:
        request = Request(url, headers=headers)
        with urlopen(request, timeout=30) as response:
            data = response.read()
            content_type = response.headers.get_content_type()

    kind = image_kind(data)
    if kind is not None and content_type.startswith("image/"):
        reference_kind = f"{kind} image"
    elif content_type == "application/zip":
        validate_zip(data)
        reference_kind = "ZIP archive"
    else:
        raise ValueError(
            f"attachment was not a supported image or ZIP archive (content-type={content_type!r})"
        )

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    print(f"Downloaded {reference_kind} ({len(data)} bytes) to {destination}")


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
