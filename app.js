const statusEl = document.getElementById('status');
const summarySection = document.getElementById('summary');
const hourlySection = document.getElementById('hourly');
const hourlyRows = document.getElementById('hourly-rows');
const errorEl = document.getElementById('error');
const layerEl = document.getElementById('layer');
const layerDetailEl = document.getElementById('layer-detail');
const umbrellaEl = document.getElementById('umbrella');
const umbrellaDetailEl = document.getElementById('umbrella-detail');
const locationNameEl = document.getElementById('location-name');
const searchForm = document.getElementById('search-form');
const locationInput = document.getElementById('location-input');
const useCurrentBtn = document.getElementById('use-current');
const searchSubmitBtn = searchForm.querySelector('button[type="submit"]');

const GEO_TIMEOUT = 25000;
const SHORT_TERM_HOURS = 6;
const DISPLAY_HOURS = 24;
const DEFAULT_LOCATION = { name: 'New York, NY', latitude: 40.7128, longitude: -74.006 }; // NYC default fallback
const COORDINATE_LABEL_PATTERN = /^\d+(?:\.\d+)?°[NS], \d+(?:\.\d+)?°[EW]$/;
const hasGeolocation = 'geolocation' in navigator;
const COUNTRY_CODE_OVERRIDES = {
  GB: 'United Kingdom',
  US: 'United States',
  KR: 'South Korea',
  KP: 'North Korea'
};
const PLACE_NAME_OVERRIDES = {
  'United Kingdom of Great Britain and Northern Ireland (the)': 'United Kingdom',
  'United Kingdom of Great Britain and Northern Ireland': 'United Kingdom',
  'United States of America (the)': 'United States',
  'United States of America': 'United States',
  'Russian Federation': 'Russia',
  'Viet Nam': 'Vietnam',
  'Korea (Republic of)': 'South Korea',
  "Korea (Democratic People's Republic of)": 'North Korea',
  'Iran (Islamic Republic of)': 'Iran'
};

const layerBands = [
  { maxF: 0, label: "Don't Go Outside", detail: "Dangerously cold — stay indoors if you can." },
  { maxF: 40, label: "Winter Jacket", detail: "Frigid conditions — heavy layers are essential." },
  { maxF: 55, label: "Heavy Jacket", detail: "Chilly weather — insulated outerwear recommended." },
  { maxF: 65, label: "Light Jacket", detail: "Cool breeze — a lighter outer layer feels comfortable." },
  { maxF: 70, label: "Long Sleeve", detail: "Mild temps — long sleeves should do the trick." },
  { maxF: 85, label: "Short Sleeve", detail: "Warm weather — short sleeves are plenty." },
  { maxF: Infinity, label: "Shirtless", detail: "Hot conditions — minimal layers suggested." }
];

let latestRequestId = 0;
let activeLocation = { ...DEFAULT_LOCATION };
let locationNameRefreshInFlight = false;
let lastAppliedLocationLabel = '';

document.addEventListener('DOMContentLoaded', () => {
  attachEventHandlers();

  if (!hasGeolocation) {
    useCurrentBtn.disabled = true;
    useCurrentBtn.textContent = 'Geolocation unavailable';
  }

  loadForecast(DEFAULT_LOCATION, {
    statusMessage: 'Loading forecast for New York City…',
    preserveOnError: false
  });

  if (hasGeolocation) {
    attemptAutoGeolocation();
  }
});

function attachEventHandlers() {
  searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = locationInput.value.trim();
    if (!query) {
      showError('Enter a city, postal code, or coordinates to search.', { preserveData: true });
      return;
    }
    try {
      setStatus('Searching for location…');
      setControlsDisabled(true);
      const location = await resolveSearchQuery(query);
      if (!location) {
        showError(`No results for "${query}". Try another place.`, { preserveData: true });
        setControlsDisabled(false);
        return;
      }
      await loadForecast(location, {
        statusMessage: `Obtaining weather for ${location.name}…`,
        preserveOnError: true
      });
    } catch (error) {
      console.error(error);
      showError('Something went wrong while looking up that place. Please try again.', { preserveData: true });
    } finally {
      setControlsDisabled(false);
    }
  });

  useCurrentBtn.addEventListener('click', () => {
    if (!hasGeolocation) {
      showError('Geolocation is not supported in this browser.', { preserveData: true });
      return;
    }

    setStatus('Requesting your current location…');
    setControlsDisabled(true);

    requestCurrentPosition()
      .then((position) => {
        setControlsDisabled(false);
        handleGeolocationSuccess(position, { triggeredBy: 'manual' });
      })
      .catch((error) => {
        setControlsDisabled(false);
        handleGeolocationError(error, { silent: false });
      });
  });
}

async function handleGeolocationSuccess(position, { triggeredBy = 'manual' } = {}) {
  const { latitude, longitude } = position.coords;
  const name = await resolveLocationName(latitude, longitude);
  await loadForecast(
    { latitude, longitude, name },
    {
      statusMessage: triggeredBy === 'manual'
        ? 'Updating forecast with your location…'
        : 'Obtaining weather for your location…',
      preserveOnError: true
    }
  );
}

function handleGeolocationError(error, { silent } = {}) {
  console.warn('Geolocation error', error);
  if (silent) {
    return;
  }
  let message = 'We could not access your location. Please enable permissions and try again.';
  if (error.code === error.PERMISSION_DENIED) {
    message = 'Location access was denied. Enable it in your browser settings and try again.';
  } else if (error.code === error.POSITION_UNAVAILABLE) {
    message = 'Location information is unavailable right now. Please try again.';
  } else if (error.code === error.TIMEOUT) {
    message = 'Getting your location timed out. Please try again.';
  }
  showError(message, { preserveData: true });
}

function attemptAutoGeolocation() {
  const permissions = navigator.permissions;
  if (!permissions || typeof permissions.query !== 'function') {
    return;
  }
  permissions
    .query({ name: 'geolocation' })
    .then((status) => {
      if (status.state !== 'granted') {
        return;
      }
      requestCurrentPosition()
        .then((position) => {
          handleGeolocationSuccess(position, { triggeredBy: 'auto' });
        })
        .catch((error) => {
          console.warn('Automatic geolocation failed', error);
        });
    })
    .catch((error) => {
      console.warn('Permissions API error', error);
    });
}

function requestCurrentPosition() {
  const primaryOptions = {
    enableHighAccuracy: false,
    timeout: GEO_TIMEOUT,
    maximumAge: 5 * 60 * 1000
  };
  const fallbackOptions = {
    enableHighAccuracy: true,
    timeout: GEO_TIMEOUT,
    maximumAge: 0
  };

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      if (error && (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE)) {
        navigator.geolocation.getCurrentPosition(resolve, reject, fallbackOptions);
      } else {
        reject(error);
      }
    }, primaryOptions);
  });
}

async function loadForecast(location, options = {}) {
  const requestId = ++latestRequestId;
  const {
    statusMessage,
    errorMessage = 'Unable to retrieve the forecast right now. Please try again in a bit.',
    preserveOnError = false
  } = options;

  const displayName = location.name ?? formatCoordinates(location.latitude, location.longitude);
  setStatus(statusMessage ?? `Obtaining weather for ${displayName}…`);
  setControlsDisabled(true);

  try {
    const forecast = await fetchForecast(location.latitude, location.longitude);
    if (requestId !== latestRequestId) {
      return;
    }
    applyActiveLocation({ ...location, name: displayName });
    renderForecast(forecast);
  } catch (error) {
    console.error(error);
    if (requestId !== latestRequestId) {
      return;
    }
    showError(errorMessage, { preserveData: preserveOnError });
  } finally {
    if (requestId === latestRequestId) {
      setControlsDisabled(false);
    }
  }
}

async function resolveSearchQuery(query) {
  const coordinateResult = parseCoordinateQuery(query);
  if (coordinateResult) {
    const name = await resolveLocationName(coordinateResult.latitude, coordinateResult.longitude);
    return { ...coordinateResult, name };
  }

  const params = new URLSearchParams({
    name: query,
    count: '1',
    language: 'en',
    format: 'json'
  });

  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Geocoding search failed: ${response.status}`);
  }
  const data = await response.json();
  const result = data?.results?.[0];
  if (!result) {
    return null;
  }
  return {
    latitude: result.latitude,
    longitude: result.longitude,
    name: buildPlaceName(result)
  };
}

async function resolveLocationName(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  const attempts = [
    { latitude, longitude },
    { latitude: Number(latitude.toFixed(3)), longitude: Number(longitude.toFixed(3)) },
    { latitude: Number(latitude.toFixed(2)), longitude: Number(longitude.toFixed(2)) }
  ];

  for (const attempt of attempts) {
    const placeName = await attemptReverseGeocoding(attempt.latitude, attempt.longitude);
    if (placeName) {
      return placeName;
    }
  }

  return formatCoordinates(latitude, longitude);
}

async function attemptReverseGeocoding(lat, lon) {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      localityLanguage: 'en'
    });
    // BigDataCloud provides a browser-accessible reverse geocoding endpoint with permissive CORS.
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.status}`);
    }
    const data = await response.json();
    const candidate = buildReverseGeocodeName(data);
    if (candidate) {
      return candidate;
    }
  } catch (error) {
    console.warn('Reverse geocoding error', error);
  }
  return null;
}

async function fetchForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability',
    forecast_days: '2',
    timezone: 'auto'
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Forecast request failed: ${response.status}`);
  }
  return response.json();
}

function renderForecast(forecast) {
  const times = forecast?.hourly?.time ?? [];
  const tempsC = forecast?.hourly?.temperature_2m ?? [];
  const apparentC = forecast?.hourly?.apparent_temperature ?? [];
  const precipProb = forecast?.hourly?.precipitation_probability ?? [];

  const now = new Date();
  const hourlyData = [];

  for (let i = 0; i < times.length; i += 1) {
    const time = new Date(times[i]);
    if (hourlyData.length < DISPLAY_HOURS && time >= now) {
      hourlyData.push({
        time,
        tempC: tempsC[i],
        feelsC: apparentC[i],
        precip: precipProb[i]
      });
    }
  }

  if (!hourlyData.length) {
    showError('Could not find upcoming forecast data. Please try again later.');
    return;
  }

  const shortTerm = hourlyData.slice(0, Math.min(SHORT_TERM_HOURS, hourlyData.length));
  const shortTermFeels = shortTerm
    .map((entry) => (Number.isFinite(entry.feelsC) ? entry.feelsC : entry.tempC))
    .filter((value) => Number.isFinite(value));

  const minFeelsC = shortTermFeels.length ? Math.min(...shortTermFeels) : shortTerm[0].tempC;
  const minFeelsF = cToF(minFeelsC);

  const { label, detail } = pickLayer(minFeelsF);
  layerEl.textContent = label;
  layerDetailEl.textContent = `${detail} Minimum feels-like: ${Math.round(minFeelsF)}°F (${Math.round(minFeelsC)}°C).`;

  const shortTermPrecip = shortTerm
    .map((entry) => (Number.isFinite(entry.precip) ? entry.precip : 0));
  const maxPrecip = shortTermPrecip.length ? Math.max(...shortTermPrecip) : 0;
  const needsUmbrella = Number.isFinite(maxPrecip) && maxPrecip >= 50;
  umbrellaEl.textContent = needsUmbrella ? 'Bring Umbrella' : 'No Umbrella';
  umbrellaDetailEl.textContent = needsUmbrella
    ? `Precipitation chance peaks at ${Math.round(maxPrecip)}% in the next ${shortTerm.length} hours.`
    : `Precipitation chance stays below 50% (max ${Math.round(maxPrecip)}%).`;

  const formatter = new Intl.DateTimeFormat([], {
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    timeZone: forecast?.timezone ?? undefined
  });

  hourlyRows.innerHTML = '';
  hourlyData.forEach((entry) => {
    const tempF = cToF(entry.tempC);
    const feelsF = cToF(entry.feelsC);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatter.format(entry.time)}</td>
      <td>${formatTempPair(tempF, entry.tempC)}</td>
      <td>${formatTempPair(feelsF, entry.feelsC)}</td>
      <td>${formatPrecip(entry.precip)}</td>
    `;
    hourlyRows.appendChild(row);
  });

  statusEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  summarySection.classList.remove('hidden');
  hourlySection.classList.remove('hidden');
}

function applyActiveLocation(location) {
  activeLocation = location;
  const label = location.name ?? formatCoordinates(location.latitude, location.longitude);
  updateLocationDisplay(label);
  if (looksLikeCoordinateLabel(label)) {
    void improveLocationName(location.latitude, location.longitude);
  }
}

async function improveLocationName(lat, lon) {
  if (locationNameRefreshInFlight) {
    return;
  }
  locationNameRefreshInFlight = true;
  try {
    const resolvedName = await resolveLocationName(lat, lon);
    if (resolvedName && !looksLikeCoordinateLabel(resolvedName) && resolvedName !== activeLocation.name) {
      activeLocation = { ...activeLocation, name: resolvedName };
      updateLocationDisplay(resolvedName);
    }
  } catch (error) {
    console.warn('Unable to refine location name', error);
  } finally {
    locationNameRefreshInFlight = false;
  }
}

function updateLocationDisplay(label) {
  locationNameEl.textContent = label;
  const trimmedValue = locationInput.value.trim();
  if (!trimmedValue || trimmedValue === lastAppliedLocationLabel) {
    locationInput.value = label;
  }
  locationInput.placeholder = label;
  lastAppliedLocationLabel = label;
}

function looksLikeCoordinateLabel(label) {
  return typeof label === 'string' && COORDINATE_LABEL_PATTERN.test(label);
}

function setStatus(message) {
  statusEl.textContent = message;
  statusEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  summarySection.classList.add('hidden');
  hourlySection.classList.add('hidden');
}

function showError(message, { preserveData = false } = {}) {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
  statusEl.classList.add('hidden');
  if (!preserveData) {
    summarySection.classList.add('hidden');
    hourlySection.classList.add('hidden');
  }
}

function setControlsDisabled(disabled) {
  locationInput.disabled = disabled;
  searchSubmitBtn.disabled = disabled;
  if (hasGeolocation) {
    useCurrentBtn.disabled = disabled;
  }
}

function pickLayer(tempF) {
  return layerBands.find((band) => tempF <= band.maxF) ?? layerBands[layerBands.length - 1];
}

function cToF(tempC) {
  if (!Number.isFinite(tempC)) {
    return NaN;
  }
  return (tempC * 9) / 5 + 32;
}

function formatTempPair(fahrenheit, celsius) {
  if (!Number.isFinite(celsius)) {
    return '—';
  }
  return `${Math.round(fahrenheit)}°F / ${Math.round(celsius)}°C`;
}

function formatPrecip(value) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return `${Math.round(value)}%`;
}

function parseCoordinateQuery(query) {
  const match = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (match) {
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }
  return null;
}

function buildPlaceName(result) {
  if (!result) {
    return '';
  }
  const primary = result.name || result.admin2 || result.admin1 || result.country || '';
  return assembleLocationLabel([
    { value: primary },
    { value: result.admin1 },
    { value: result.country, type: 'country', code: result.country_code }
  ]);
}

function buildReverseGeocodeName(result) {
  if (!result) {
    return '';
  }

  const administrativeEntries = result?.localityInfo?.administrative ?? [];
  const informativeEntries = result?.localityInfo?.informative ?? [];
  const fallbackAdmin = [...administrativeEntries, ...informativeEntries]
    .map((entry) => entry?.name)
    .find(Boolean);

  const primary = result.city
    || result.locality
    || fallbackAdmin
    || result.principalSubdivision
    || result.countryName
    || '';

  const parts = [primary];
  if (result.principalSubdivision && result.principalSubdivision !== primary) {
    parts.push(result.principalSubdivision);
  }
  if (result.countryName && result.countryName !== primary) {
    parts.push({ value: result.countryName, type: 'country', code: result.countryCode });
  }

  return assembleLocationLabel(parts);
}

function formatCoordinates(lat, lon) {
  const latSuffix = lat >= 0 ? 'N' : 'S';
  const lonSuffix = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${latSuffix}, ${Math.abs(lon).toFixed(2)}°${lonSuffix}`;
}

function assembleLocationLabel(segments, { maxParts = 3 } = {}) {
  const seen = new Set();
  const normalized = [];
  segments.forEach((segment) => {
    if (!segment) {
      return;
    }
    const payload = typeof segment === 'string' ? { value: segment } : segment;
    const value = normalizePlacePart(payload.value, payload);
    if (!value) {
      return;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    normalized.push(value);
  });
  return normalized.slice(0, maxParts).join(', ');
}

function normalizePlacePart(rawValue, { type, code } = {}) {
  if (!rawValue || typeof rawValue !== 'string') {
    return '';
  }
  let value = rawValue.trim();
  if (!value) {
    return '';
  }
  const override = PLACE_NAME_OVERRIDES[value];
  if (override) {
    value = override;
  }
  if (/\s*\(the\)$/i.test(value)) {
    value = value.replace(/\s*\(the\)$/i, '');
  }
  if (type === 'country' && code) {
    const upperCode = String(code).toUpperCase();
    if (COUNTRY_CODE_OVERRIDES[upperCode]) {
      value = COUNTRY_CODE_OVERRIDES[upperCode];
    }
  }
  return value;
}
