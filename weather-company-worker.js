/**
 * Cloudflare Worker proxy for needajacket.today.
 *
 * Required secret:
 *   wrangler secret put TWC_API_KEY
 *
 * Optional variable:
 *   ALLOWED_ORIGIN=https://needajacket.today
 *
 * The page remains a static single-page site. This edge proxy prevents the
 * Weather Company API key from being exposed in browser source.
 */
export default {
  async fetch(request, env, ctx) {
    const requestUrl = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "https://needajacket.today";
    const corsOrigin = origin === allowedOrigin || origin === "null" ? origin : allowedOrigin;
    const cors = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Content-Type",
      Vary: "Origin"
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, cors);
    if (!env.TWC_API_KEY) return json({ error: "TWC_API_KEY is not configured" }, 500, cors);

    const lat = Number(requestUrl.searchParams.get("lat"));
    const lon = Number(requestUrl.searchParams.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return json({ error: "Valid lat and lon parameters are required" }, 400, cors);
    }

    const roundedLat = lat.toFixed(2);
    const roundedLon = lon.toFixed(2);
    const cacheUrl = new URL(requestUrl.origin + requestUrl.pathname);
    cacheUrl.search = new URLSearchParams({ lat: roundedLat, lon: roundedLon }).toString();
    const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) return withCors(cached, cors);

    try {
      const geocode = `${roundedLat},${roundedLon}`;
      const base = "https://api.weather.com/v3/wx";
      const common = `geocode=${encodeURIComponent(geocode)}&format=json&units=e&language=en-US&apiKey=${encodeURIComponent(env.TWC_API_KEY)}`;
      const [currentResponse, hourlyResponse] = await Promise.all([
        fetch(`${base}/observations/current?${common}`),
        fetch(`${base}/forecast/hourly/2day?${common}`)
      ]);

      if (!currentResponse.ok || !hourlyResponse.ok) {
        return json({
          error: "Weather Company upstream error",
          currentStatus: currentResponse.status,
          hourlyStatus: hourlyResponse.status
        }, 502, cors);
      }

      const [current, hourly] = await Promise.all([currentResponse.json(), hourlyResponse.json()]);
      const count = Math.min(24, hourly.validTimeLocal?.length || 0);
      const hours = Array.from({ length: count }, (_, i) => ({
        time: hourly.validTimeLocal[i],
        temperature: hourly.temperature?.[i],
        feelsLike: hourly.temperatureFeelsLike?.[i] ?? hourly.temperature?.[i],
        precipProbability: hourly.precipChance?.[i] ?? 0,
        phrase: hourly.wxPhraseLong?.[i] || hourly.wxPhraseShort?.[i] || "Variable conditions",
        windSpeed: hourly.windSpeed?.[i] ?? 0,
        iconCode: hourly.iconCode?.[i]
      })).filter(hour => Number.isFinite(hour.temperature));

      const normalized = {
        provider: "Weather Underground / The Weather Company",
        updatedAt: current.validTimeLocal || new Date().toISOString(),
        timezone: current.timezone || null,
        current: {
          time: current.validTimeLocal || hours[0]?.time || new Date().toISOString(),
          temperature: current.temperature,
          feelsLike: current.temperatureFeelsLike ?? current.temperature,
          precipProbability: hours[0]?.precipProbability || 0,
          phrase: current.wxPhraseLong || current.wxPhraseMedium || current.wxPhraseShort || hours[0]?.phrase,
          windSpeed: current.windSpeed ?? 0,
          precipitation: current.precip1Hour ?? 0,
          iconCode: current.iconCode
        },
        hourly: hours
      };

      const response = json(normalized, 200, {
        ...cors,
        "Cache-Control": "public, max-age=300, s-maxage=600"
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      return json({ error: "Weather proxy failed", detail: error.message }, 502, cors);
    }
  }
};

function json(value, status, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}

function withCors(response, cors) {
  const headers = new Headers(response.headers);
  Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
