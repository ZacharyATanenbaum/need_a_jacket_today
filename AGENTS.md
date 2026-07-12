# Repository instructions

## Downloading design references

When a design reference is supplied as a signed ChatGPT/Estuary attachment URL or an
encrypted Proton Drive share, use `scripts/download_reference.py` instead of `curl`.
The script sends browser-like headers for direct attachments, opens Proton shares in a
local Playwright browser so they can decrypt client-side, validates the resulting image,
and writes it to a local file for screenshot inspection.

```bash
python3 scripts/download_reference.py '<signed-url>' /tmp/reference.png
```

Do not commit downloaded references unless the user explicitly asks for that. Signed
URLs and optional session cookies are sensitive and must not be written into source
files, logs, commits, or assistant responses. If authentication is required, provide
the cookie through the `CHATGPT_COOKIE` environment variable or pass a Firefox profile
with `--firefox-profile`. The downloader must read only `chatgpt.com` cookies and must
never print or persist their values.
