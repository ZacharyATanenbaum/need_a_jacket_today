const HORIZON_HOURS = 6;
const DISPLAY_HOURS = 24;
const DEFAULT_LOCATION = { name: 'New York, NY', lat: 40.7128, lon: -74.006 };
const GEO_TIMEOUT = 25000;
const COORDINATE_LABEL_PATTERN = /^\d+(?:\.\d+)?°[NS], \d+(?:\.\d+)?°[EW]$/;
const UNIT_STORAGE_KEY = 'need-a-jacket-unit';
const PROFILE_STORAGE_KEY = 'need-a-jacket-profile';

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

const el = (selector) => document.querySelector(selector);

const locationLineEl = el('#location-line');
const updatedAtEl = el('#updated-at');
const wearLabelEl = el('#wear-label');
const umbrellaLineEl = el('#umbrella-line');
const unitCBtn = el('#unit-c');
const unitFBtn = el('#unit-f');
const useLocationBtn = el('#use-location');
const useLocationLabelCompact = useLocationBtn?.querySelector('[data-label="compact"]');
const useLocationLabelFull = useLocationBtn?.querySelector('[data-label="full"]');
const openSearchBtn = el('#open-search');
const closeSearchBtn = el('#close-search');
const navDefault = el('#nav-default');
const navSearch = el('#nav-search');
const searchInput = el('#search-input');
const searchSubmitBtn = el('#search-submit');
const hourlyContainer = el('#hourly-24');
const hourlySummaryEl = el('#hourly-summary');
const refreshBtn = el('#refresh');
const avatarImg = el('#avatar-image');
const profileHotBtn = el('#profile-hot');
const profileRegularBtn = el('#profile-regular');
const profileColdBtn = el('#profile-cold');

const PROFILE_BUTTON_BASE_CLASS =
  'px-3 py-2 flex items-center justify-center whitespace-nowrap text-xs sm:text-sm';
const AVATAR_BASE_PATH = 'images/webp';
const AVATAR_LOOKUP = {
  dontgo: { base: '0__stay_at_home', umbrellas: false },
  winter: { base: '1__cold', umbrellas: true },
  heavy: { base: '2__puffer', umbrellas: true },
  light: { base: '3__bomber', umbrellas: true },
  long: { base: '4__long_sleeve', umbrellas: true },
  short: { base: '5__t-shirt', umbrellas: true },
  shirtless: { base: '6__no_shirt', umbrellas: true }
};
const AVATAR_ALT_LABELS = {
  dontgo: "Stay inside avatar",
  winter: 'Winter jacket avatar',
  heavy: 'Heavy jacket avatar',
  light: 'Light jacket avatar',
  long: 'Long sleeve avatar',
  short: 'Short sleeve avatar',
  shirtless: 'Shirtless avatar'
};

const state = {
  unit: 'F',
  profile: 'regular',
  current: { mode: 'sample' },
  hourly24: [],
  decisions: null,
  horizon: HORIZON_HOURS
};

state.unit = loadStoredUnit();
state.profile = loadStoredProfile();

const sampleData = {
  asOf: new Date().toISOString(),
  location: { name: DEFAULT_LOCATION.name, lat: DEFAULT_LOCATION.lat, lon: DEFAULT_LOCATION.lon },
  horizonHours: HORIZON_HOURS,
  hourly: []
};

let latestRequestId = 0;

// --- Initialization ---
main();

function main() {
  wireUi();
  syncUnitButtons();
  syncProfileButtons();
  applySampleForecast('Loading sample data…');
  loadDefaultForecast();
  attemptAutoGeolocation();
}

function wireUi() {
  unitCBtn.addEventListener('click', () => setUnit('C'));
  unitFBtn.addEventListener('click', () => setUnit('F'));
  profileHotBtn.addEventListener('click', () => setProfile('hot'));
  profileRegularBtn.addEventListener('click', () => setProfile('regular'));
  profileColdBtn.addEventListener('click', () => setProfile('cold'));

  openSearchBtn.addEventListener('click', openSearch);
  closeSearchBtn.addEventListener('click', closeSearch);
  searchSubmitBtn.addEventListener('click', handleSearchSubmit);
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearchSubmit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (navSearch.classList.contains('hidden')) {
      return;
    }
    const insideSearch = event.target.closest('#nav-search');
    const isTrigger = event.target.closest('#open-search');
    if (!insideSearch && !isTrigger) {
      closeSearch();
    }
  });

  refreshBtn.addEventListener('click', () => {
    doRefresh();
  });

  if ('geolocation' in navigator) {
    setUseLocationLabel('Use my location', 'Use location');
    useLocationBtn.addEventListener('click', () => useMyLocation());
  } else {
    useLocationBtn.disabled = true;
    setUseLocationLabel('Geolocation unavailable', 'No geolocation');
  }
}

// --- UI helpers ---
function setUnit(nextUnit) {
  if (state.unit === nextUnit) {
    syncUnitButtons();
    return;
  }
  state.unit = nextUnit;
  saveUnit(nextUnit);
  syncUnitButtons();
  renderHourly24(state.hourly24);
  if (state.decisions) {
    wearLabelEl.textContent = state.decisions.band;
    updateUmbrellaLine(state.decisions.umbrella);
  }
}

function syncUnitButtons() {
  if (state.unit === 'F') {
    unitFBtn.className = 'h-full px-3 flex items-center justify-center bg-slate-100 text-slate-900';
    unitCBtn.className = 'h-full px-3 flex items-center justify-center text-slate-200';
  } else {
    unitCBtn.className = 'h-full px-3 flex items-center justify-center bg-slate-100 text-slate-900';
    unitFBtn.className = 'h-full px-3 flex items-center justify-center text-slate-200';
  }
}

function setProfile(nextProfile) {
  if (!['hot', 'regular', 'cold'].includes(nextProfile)) {
    return;
  }
  if (state.profile === nextProfile) {
    syncProfileButtons();
    return;
  }
  state.profile = nextProfile;
  saveProfile(nextProfile);
  syncProfileButtons();
  recomputeDecisions();
}

function syncProfileButtons() {
  profileHotBtn.className = profileButtonClass(state.profile === 'hot');
  profileRegularBtn.className = profileButtonClass(state.profile === 'regular');
  profileColdBtn.className = profileButtonClass(state.profile === 'cold');
}

function profileButtonClass(isActive) {
  const activeClasses = `${PROFILE_BUTTON_BASE_CLASS} bg-slate-100 text-slate-900`;
  const inactiveClasses = `${PROFILE_BUTTON_BASE_CLASS} text-slate-200`;
  return isActive ? activeClasses : inactiveClasses;
}

function setUseLocationLabel(fullLabel, compactLabel) {
  if (!useLocationBtn) {
    return;
  }
  if (useLocationLabelFull && useLocationLabelCompact) {
    useLocationLabelFull.textContent = fullLabel;
    useLocationLabelCompact.textContent = compactLabel ?? fullLabel;
  } else {
    useLocationBtn.textContent = fullLabel;
  }
}

function openSearch() {
  navDefault.classList.add('opacity-0', 'pointer-events-none');
  navSearch.classList.remove('hidden');
  setTimeout(() => searchInput.focus(), 0);
}

function closeSearch() {
  navSearch.classList.add('hidden');
  navDefault.classList.remove('opacity-0', 'pointer-events-none');
  searchInput.value = '';
}

function setLoadingUi(message) {
  locationLineEl.textContent = message;
  updatedAtEl.textContent = 'Updated —';
  wearLabelEl.textContent = '—';
  umbrellaLineEl.textContent = 'Umbrella —';
  hourlySummaryEl.textContent = 'Loading…';
  hourlyContainer.innerHTML = '';
}

function updateUmbrellaLine(umbrella) {
  const suffix = umbrella.when ? ` after ${umbrella.when}` : '';
  umbrellaLineEl.textContent = `Umbrella: ${umbrella.label}${suffix}`;
}

function applyForecast(data) {
  const hourly = normalize24(data.asOf, data.hourly ?? []);
  state.hourly24 = hourly;
  const horizon = data.horizonHours ?? HORIZON_HOURS;
  state.horizon = horizon;
  const decisions = decideFromHourly(hourly, horizon, state.profile);
  state.decisions = decisions;

  const outfitKey = outfitKeyForBand(decisions.band);
  updateAvatar(outfitKey, decisions.umbrella.label === 'Yes');

  wearLabelEl.textContent = decisions.band;
  updateUmbrellaLine(decisions.umbrella);
  renderHourly24(hourly);

  locationLineEl.textContent = data.location?.name ?? '—';
  updatedAtEl.textContent = `Updated ${new Date(data.asOf).toTimeString().slice(0, 5)}`;
}

function recomputeDecisions() {
  if (!state.hourly24.length) {
    return;
  }
  const decisions = decideFromHourly(state.hourly24, state.horizon ?? HORIZON_HOURS, state.profile);
  state.decisions = decisions;

  const outfitKey = outfitKeyForBand(decisions.band);
  updateAvatar(outfitKey, decisions.umbrella.label === 'Yes');

  wearLabelEl.textContent = decisions.band;
  updateUmbrellaLine(decisions.umbrella);
}

function renderHourly24(hours) {
  hourlyContainer.innerHTML = '';
  if (!hours || !hours.length) {
    hourlySummaryEl.textContent = 'No forecast available.';
    return;
  }

  const feels = hours.map((entry) => entry.feelsLikeC ?? entry.tempC);
  const probs = hours.map((entry) => entry.precipProb ?? 0);
  const maxFeels = Math.max(...feels);
  const minFeels = Math.min(...feels);
  const maxProb = Math.max(...probs);
  hourlySummaryEl.textContent = `Feels ${Math.round(maybeUnit(minFeels))}\u2013${Math.round(maybeUnit(maxFeels))} ${unitSuffix()} • Rain ${Math.round(maxProb)}% max`;

  hours.forEach((entry) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'w-16 shrink-0 rounded-xl bg-slate-800/60 border border-slate-800 p-2 text-center';

    const timeEl = document.createElement('div');
    timeEl.className = 'text-[11px] text-slate-400';
    timeEl.textContent = labelHour(entry.time);

    const iconEl = document.createElement('div');
    iconEl.className = 'my-1 flex justify-center text-slate-200';
    iconEl.innerHTML = svgIcon(iconFor(entry));

    const tempEl = document.createElement('div');
    tempEl.className = 'text-sm font-medium';
    tempEl.textContent = `${Math.round(maybeUnit(entry.tempC))}°`;

    const feelsEl = document.createElement('div');
    feelsEl.className = 'text-[10px] text-slate-400';
    feelsEl.textContent = `feels ${Math.round(maybeUnit(entry.feelsLikeC ?? entry.tempC))}°`;

    const precipEl = document.createElement('div');
    precipEl.className = 'text-[10px] text-slate-400';
    precipEl.textContent = `${Math.round(entry.precipProb ?? 0)}%`;

    wrapper.append(timeEl, iconEl, tempEl, feelsEl, precipEl);
    hourlyContainer.appendChild(wrapper);
  });
}

function updateAvatar(outfitKey, showUmbrella) {
  if (!avatarImg) {
    return;
  }
  const entry = AVATAR_LOOKUP[outfitKey] ?? AVATAR_LOOKUP.short;
  const file = entry.umbrellas
    ? `${entry.base}__${showUmbrella ? 'umbrella' : 'no_umbrella'}-512.webp`
    : `${entry.base}-512.webp`;
  avatarImg.src = `${AVATAR_BASE_PATH}/${file}`;
  const altBase = AVATAR_ALT_LABELS[outfitKey] ?? 'Outfit avatar';
  avatarImg.alt = entry.umbrellas
    ? `${altBase} ${showUmbrella ? 'with umbrella' : 'without umbrella'}`
    : altBase;
}

function maybeUnit(valueC) {
  return state.unit === 'F' ? cToF(valueC) : valueC;
}

function unitSuffix() {
  return state.unit === 'F' ? '°F' : '°C';
}

function labelHour(iso) {
  const date = new Date(iso);
  return `${pad2(date.getHours())}:00`;
}

function pad2(number) {
  return number < 10 ? `0${number}` : String(number);
}

// --- Data fetch + decisions ---
async function handleSearchSubmit() {
  const query = searchInput.value.trim();
  if (!query) {
    hourlySummaryEl.textContent = 'Enter a city or coordinates to search.';
    return;
  }
  closeSearch();
  await fetchForQuery(query);
}

async function loadDefaultForecast() {
  await fetchForCoords(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon, {
    label: DEFAULT_LOCATION.name,
    mode: 'default'
  });
}

async function fetchForCoords(lat, lon, options = {}) {
  const label = options.label ?? formatCoordinates(lat, lon);
  const requestId = ++latestRequestId;
  setLoadingUi(`Loading forecast for ${label}…`);
  try {
    const [forecast, resolvedName] = await Promise.all([
      fetchForecast(lat, lon),
      options.label ? Promise.resolve(options.label) : resolveLocationName(lat, lon)
    ]);

    if (requestId !== latestRequestId) {
      return;
    }

    const hourly = extractHourly(forecast);
    if (!hourly.length) {
      throw new Error('No hourly forecast data returned.');
    }

    const locationName = resolvedName ?? formatCoordinates(lat, lon);
    const decisionData = {
      asOf: new Date().toISOString(),
      location: { name: locationName, lat, lon },
      horizonHours: HORIZON_HOURS,
      hourly
    };

    applyForecast(decisionData);
    state.current = {
      mode: options.mode ?? 'coords',
      lat,
      lon,
      label: locationName,
      query: options.query ?? null
    };
    hourlySummaryEl.textContent = hourlySummaryEl.textContent.replace('Loading…', '');
  } catch (error) {
    console.error('Forecast fetch failed', error);
    if (requestId !== latestRequestId) {
      return;
    }
    handleForecastError(options, error);
  }
}

async function fetchForQuery(query) {
  const requestId = ++latestRequestId;
  setLoadingUi(`Searching for "${query}"…`);
  try {
    const result = await resolveSearchQuery(query);
    if (!result) {
      hourlySummaryEl.textContent = `No results for "${query}".`;
      return;
    }
    if (requestId !== latestRequestId) {
      return;
    }
    await fetchForCoords(result.latitude, result.longitude, {
      label: result.name,
      mode: 'query',
      query
    });
  } catch (error) {
    console.error('Search failed', error);
    if (requestId !== latestRequestId) {
      return;
    }
    handleForecastError({ label: query }, error, `Showing sample data (search failed).`);
  }
}

function doRefresh() {
  const current = state.current || { mode: 'sample' };
  if (current.mode === 'coords' || current.mode === 'default') {
    void fetchForCoords(current.lat, current.lon, {
      label: current.label,
      mode: current.mode,
      query: current.query
    });
  } else if (current.mode === 'query') {
    void fetchForCoords(current.lat, current.lon, {
      label: current.label,
      mode: 'query',
      query: current.query
    });
  } else {
    applySampleForecast('Refreshing sample data…');
  }
}

function handleForecastError(options = {}, error, summary) {
  const message = summary || 'Showing sample data until the forecast service returns.';
  applySampleForecast(message, options.label);
}

function applySampleForecast(summary, labelOverride) {
  const now = new Date();
  sampleData.asOf = now.toISOString();
  sampleData.hourly = generateSampleHourly(now);
  if (labelOverride) {
    sampleData.location = {
      name: `${labelOverride} (sample)`,
      lat: sampleData.location.lat,
      lon: sampleData.location.lon
    };
  } else {
    sampleData.location = {
      name: 'Sample Forecast',
      lat: sampleData.location.lat,
      lon: sampleData.location.lon
    };
  }
  applyForecast(sampleData);
  hourlySummaryEl.textContent = summary;
  state.current = { mode: 'sample' };
}

function extractHourly(forecast) {
  const times = forecast?.hourly?.time ?? [];
  const temps = forecast?.hourly?.temperature_2m ?? [];
  const feels = forecast?.hourly?.apparent_temperature ?? [];
  const precip = forecast?.hourly?.precipitation_probability ?? [];

  const result = [];
  const now = new Date();
  const start = roundDownToHour(now);

  for (let index = 0; index < times.length; index += 1) {
    const point = new Date(times[index]);
    if (point < start) {
      continue;
    }
    if (result.length >= DISPLAY_HOURS) {
      break;
    }
    const tempC = toFiniteOrNull(temps[index]);
    const feelsC = toFiniteOrNull(feels[index]);
    const precipProb = toFiniteOrNull(precip[index]);
    result.push({
      time: point.toISOString(),
      tempC: tempC ?? feelsC ?? 0,
      feelsLikeC: feelsC ?? tempC ?? 0,
      precipProb: precipProb ?? 0
    });
  }

  return result;
}

function toFiniteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

// --- Geolocation ---
function useMyLocation() {
  useLocationBtn.disabled = true;
  setLoadingUi('Requesting your location…');
  requestCurrentPosition()
    .then((position) => {
      const { latitude, longitude } = position.coords;
      return fetchForCoords(latitude, longitude, { mode: 'coords' });
    })
    .catch((error) => {
      console.warn('Geolocation error', error);
      applySampleForecast('Unable to access your location. Showing sample data.');
    })
    .finally(() => {
      useLocationBtn.disabled = false;
    });
}

function attemptAutoGeolocation() {
  if (!('permissions' in navigator) || typeof navigator.permissions.query !== 'function') {
    return;
  }
  navigator.permissions
    .query({ name: 'geolocation' })
    .then((status) => {
      if (status.state === 'granted') {
        requestCurrentPosition()
          .then((position) => {
            const { latitude, longitude } = position.coords;
            return fetchForCoords(latitude, longitude, { mode: 'coords' });
          })
          .catch((error) => {
            console.debug('Auto geolocation failed', error);
          });
      }
    })
    .catch((error) => {
      console.debug('Permissions API unavailable', error);
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
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        if (error && (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE)) {
          navigator.geolocation.getCurrentPosition(resolve, reject, fallbackOptions);
        } else {
          reject(error);
        }
      },
      primaryOptions
    );
  });
}

// --- Weather decision helpers ---
function roundDownToHour(date) {
  const copy = new Date(date);
  copy.setMinutes(0, 0, 0);
  return copy;
}

function quantile(values, percentile) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  const lowerValue = sorted[lower];
  const upperValue = sorted[upper] ?? lowerValue;
  return lowerValue + (upperValue - lowerValue) * (index - lower);
}

function normalize24(asOfIso, hours) {
  const start = roundDownToHour(new Date(asOfIso));
  const slots = [];
  for (let i = 0; i < 24; i += 1) {
    const target = new Date(start.getTime() + i * 3600 * 1000);
    let closest = null;
    let bestDiff = Infinity;
    for (const hour of hours) {
      const hourTime = new Date(hour.time);
      const diff = Math.abs(hourTime - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        closest = hour;
      }
    }
    if (!closest || bestDiff > 45 * 60 * 1000) {
      const cycle = Math.sin((i / 24) * Math.PI * 2) * 4;
      const base = 12 + cycle + (Math.random() * 2 - 1);
      closest = {
        time: target.toISOString(),
        tempC: base,
        feelsLikeC: base - 1,
        precipProb: i >= 8 && i <= 12 ? 70 : i >= 13 && i <= 16 ? 50 : 10
      };
    }
    slots.push({
      time: target.toISOString(),
      tempC: closest.tempC,
      feelsLikeC: closest.feelsLikeC ?? closest.tempC,
      precipProb: closest.precipProb ?? 0
    });
  }
  return slots;
}

function decideFromHourly(hours, horizon = HORIZON_HOURS, profile = 'regular') {
  const slice = hours.slice(0, horizon);
  const feelsF = slice.map((entry) => cToF(entry.feelsLikeC ?? entry.tempC));
  const p10 = quantile(feelsF, 0.1);
  const offset = preferenceOffset(profile);
  const adjustedP10 = p10 + offset;
  const band = bandFromFeelsLikeF(adjustedP10);
  const precipIndex = slice.findIndex((entry) => (entry.precipProb ?? 0) >= 50);
  const umbrella =
    precipIndex >= 0
      ? { label: 'Yes', when: labelHour(slice[precipIndex].time) }
      : { label: 'No', when: null };
  return { band, umbrella };
}

function preferenceOffset(profile) {
  if (profile === 'hot') return 10;
  if (profile === 'cold') return -10;
  return 0;
}

function bandFromFeelsLikeF(value) {
  if (value <= 0) return "Don't Go Outside";
  if (value <= 40) return 'Winter Jacket';
  if (value <= 55) return 'Heavy Jacket';
  if (value <= 65) return 'Light Jacket';
  if (value <= 70) return 'Long Sleeve';
  if (value <= 85) return 'Short Sleeve';
  return 'Shirtless';
}

function outfitKeyForBand(label) {
  const lower = label.toLowerCase();
  if (lower.includes("don't go outside")) return 'dontgo';
  if (lower.includes('winter')) return 'winter';
  if (lower.includes('heavy')) return 'heavy';
  if (lower.includes('light')) return 'light';
  if (lower.includes('long')) return 'long';
  if (lower.includes('short sleeve')) return 'short';
  if (lower.includes('shirtless')) return 'shirtless';
  return 'short';
}

function iconFor(entry) {
  const probability = entry.precipProb ?? 0;
  if (probability >= 60) return 'rain';
  if (probability >= 30) return 'cloud';
  return 'sun';
}

function svgIcon(kind) {
  if (kind === 'rain') {
    return "<svg viewBox='0 0 24 24' class='w-5 h-5' fill='currentColor'><path d='M7 10a5 5 0 1 1 9.9 1H18a3 3 0 1 1 0 6H7a4 4 0 1 1 0-8Z'/></svg>";
  }
  if (kind === 'cloud') {
    return "<svg viewBox='0 0 24 24' class='w-5 h-5' fill='currentColor'><path d='M7 10a5 5 0 1 1 9.9 1H18a4 4 0 1 1 0 8H7a5 5 0 1 1 0-10Z'/></svg>";
  }
  return "<svg viewBox='0 0 24 24' class='w-5 h-5' fill='currentColor'><path d='M12 4a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Zm6.36 1.64a1 1 0 0 1 0 1.41l-1.41 1.41a1 1 0 1 1-1.41-1.41l1.41-1.41a1 1 0 0 1 1.41 0ZM4 13a1 1 0 1 1 0-2h2a1 1 0 1 1 0 2H4Zm14 0a1 1 0 1 1 0-2h2a1 1 0 1 1 0 2h-2ZM6.05 6.05a1 1 0 0 1 1.41 0l-1.41 1.41A1 1 0 1 1 7.46 8.87L6.05 7.46a1 1 0 0 1 0-1.41ZM17.95 17.95a1 1 0 0 1-1.41 0l-1.41-1.41a1 1 0 0 1 1.41-1.41l1.41 1.41a1 1 0 0 1 0 1.41ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'/></svg>";
}

function cToF(value) {
  return (value * 9) / 5 + 32;
}

function generateSampleHourly(asOf) {
  const start = roundDownToHour(asOf);
  const hours = [];
  for (let i = 0; i < 24; i += 1) {
    const timestamp = new Date(start.getTime() + i * 3600 * 1000);
    const cycle = Math.sin((i / 24) * Math.PI * 2) * 4;
    const base = 12 + cycle + (Math.random() * 2 - 1);
    const feels = base - (Math.random() * 1.5);
    const precipProb = i >= 8 && i <= 12 ? 70 : i >= 13 && i <= 16 ? 50 : 8;
    hours.push({
      time: timestamp.toISOString(),
      tempC: base,
      feelsLikeC: feels,
      precipProb
    });
  }
  return hours;
}

// --- Search + geocoding helpers ---
async function resolveSearchQuery(query) {
  const coordinate = parseCoordinateQuery(query);
  if (coordinate) {
    const name = await resolveLocationName(coordinate.latitude, coordinate.longitude);
    return { latitude: coordinate.latitude, longitude: coordinate.longitude, name };
  }

  const params = new URLSearchParams({
    name: query,
    count: '1',
    language: 'en',
    format: 'json'
  });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.status}`);
  }
  const payload = await response.json();
  const result = payload?.results?.[0];
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
    const candidate = await attemptReverseGeocoding(attempt.latitude, attempt.longitude);
    if (candidate) {
      return candidate;
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
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.status}`);
    }
    const data = await response.json();
    const label = buildReverseGeocodeName(data);
    if (label) {
      return label;
    }
  } catch (error) {
    console.debug('Reverse geocoding issue', error);
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

function saveUnit(unit) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(UNIT_STORAGE_KEY, unit);
    }
  } catch (error) {
    console.debug('Unable to save unit preference', error);
  }
}

function loadStoredUnit() {
  try {
    if (typeof localStorage === 'undefined') {
      return 'C';
    }
    const stored = localStorage.getItem(UNIT_STORAGE_KEY);
    if (stored === 'C' || stored === 'F') {
      return stored;
    }
    return 'F';
  } catch (error) {
    console.debug('Unable to read unit preference', error);
    return 'F';
  }
}

function saveProfile(profile) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PROFILE_STORAGE_KEY, profile);
    }
  } catch (error) {
    console.debug('Unable to save comfort preference', error);
  }
}

function loadStoredProfile() {
  try {
    if (typeof localStorage === 'undefined') {
      return 'regular';
    }
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (stored === 'hot' || stored === 'regular' || stored === 'cold') {
      return stored;
    }
    return 'regular';
  } catch (error) {
    console.debug('Unable to read comfort preference', error);
    return 'regular';
  }
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

  const administrative = result?.localityInfo?.administrative ?? [];
  const informative = result?.localityInfo?.informative ?? [];
  const fallbackAdmin = [...administrative, ...informative]
    .map((entry) => entry?.name)
    .find(Boolean);

  const primary =
    result.city ||
    result.locality ||
    fallbackAdmin ||
    result.principalSubdivision ||
    result.countryName ||
    '';

  const parts = [primary];
  if (result.principalSubdivision && result.principalSubdivision !== primary) {
    parts.push(result.principalSubdivision);
  }
  if (result.countryName && result.countryName !== primary) {
    parts.push({ value: result.countryName, type: 'country', code: result.countryCode });
  }

  return assembleLocationLabel(parts);
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

function formatCoordinates(lat, lon) {
  const latSuffix = lat >= 0 ? 'N' : 'S';
  const lonSuffix = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${latSuffix}, ${Math.abs(lon).toFixed(2)}°${lonSuffix}`;
}
