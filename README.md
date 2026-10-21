# Need A Jacket Today?

Static site that recommends what to wear (and whether to grab an umbrella) based on the next few hours of weather at a chosen location.

## Weather source

The browser requests current conditions, hourly forecasts, and location results directly from the Weather Underground / The Weather Company API. The API uses the same public client credential as the Weather Underground website; there is no server-side weather proxy. If Weather Underground fails (including HTTP 401 “API key is throttled”), forecasts and city searches automatically fall back to Open-Meteo. Each request has a timeout, and the page identifies the weather source used. If both providers fail, a recent saved forecast is used when available. Reverse geocoding still falls back to coordinates.

Open-Meteo requests use Fahrenheit, mph, inches, and Unix timestamps so forecasts remain correct when the selected city and browser have different timezones. See the [forecast API](https://open-meteo.com/en/docs) and [geocoding API](https://open-meteo.com/en/docs/geocoding-api) documentation.

## Local Preview

Geolocation only works from secure origins (HTTPS or `localhost`), so serve the files rather than opening `index.html` directly.

```bash
# From the project root
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000) in your browser.

- The page starts with a saved manual city or defaults to New York. It does not request device location on startup, even when permission was previously granted.
- Use the search box (city, ZIP/postal code, or `lat,lon`) to load a forecast.
- A manually selected location is remembered on reload. Use **Use my current location** to switch back to device location and request a fresh, high-accuracy position.
- If a requested device-location lookup fails, the page explains the error and keeps the selected city. City-name lookups time out after five seconds and fall back to coordinates; other API requests time out after twelve seconds.

## Location regression checks

Run `node --test tests/location.test.cjs` (Node.js 18+). The tests exercise the app with simulated browser location, storage, and network responses, including permission prompts, saved choices, stale responses, and timeouts.

## Deploying to GitHub Pages

Production at `https://needajacket.today` publishes from the `prod` branch, using the repository root. Push reviewed site changes to `prod` to deploy; pushing only to `main` does not update production.

1. Commit and push `index.html`, `assets/`, and this `README.md` to your repository.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select `prod` and use the root (`/`) folder.
5. Save—GitHub Pages will build and publish the site. Your URL will look like `https://<username>.github.io/<repo>/`.

Updates are automatic on every push to the configured branch.
