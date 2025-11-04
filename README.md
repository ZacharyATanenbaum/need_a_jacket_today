# Need A Jacket Today?

Static site that recommends what to wear (and whether to grab an umbrella) based on the next few hours of weather at a chosen location.

## Local Preview

Geolocation only works from secure origins (HTTPS or `localhost`), so serve the files rather than opening `index.html` directly.

```bash
# From the project root
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000) in your browser.

- Grant location permission to let the page auto-detect your position.
- Otherwise, use the search box (city, ZIP/postal code, or `lat,lon`) to load a forecast.

## Deploying to GitHub Pages

1. Commit and push `index.html`, `styles.css`, `app.js`, and this `README.md` to your repository.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the branch you want to publish (e.g., `main`) and use the root (`/`) folder.
5. Save—GitHub Pages will build and publish the site. Your URL will look like `https://<username>.github.io/<repo>/`.

Updates are automatic on every push to the configured branch.
