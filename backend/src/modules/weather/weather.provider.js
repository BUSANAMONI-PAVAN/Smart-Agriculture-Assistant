function toNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function round(value, places = 1) {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

async function fetchFromOpenMeteo(lat, lng) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=precipitation_probability,precipitation&daily=temperature_2m_max,temperature_2m_min&forecast_days=3&timezone=auto`;
  const response = await fetch(weatherUrl);
  if (!response.ok) {
    throw new Error('Open-Meteo provider returned an error.');
  }

  const payload = await response.json();
  const current = payload.current || {};
  const nowTime = current.time;
  const hourlyTimes = Array.isArray(payload.hourly?.time) ? payload.hourly.time : [];
  const index = Math.max(0, hourlyTimes.indexOf(nowTime));
  const rainChance24h = (payload.hourly?.precipitation_probability || []).slice(index, index + 24);
  const rainMm24h = (payload.hourly?.precipitation || []).slice(index, index + 24);

  return {
    provider: 'open-meteo',
    city: `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
    tempC: Math.round(toNumber(current.temperature_2m, 0)),
    feelsLikeC: Math.round(toNumber(current.apparent_temperature, 0)),
    humidity: Math.round(toNumber(current.relative_humidity_2m, 0)),
    windKmph: Math.round(toNumber(current.wind_speed_10m, 0)),
    rainChance24h: Math.round(rainChance24h.length ? Math.max(...rainChance24h) : 0),
    rainMm24h: round(rainMm24h.reduce((sum, item) => sum + toNumber(item, 0), 0)),
    maxTempC: Math.round(toNumber(payload.daily?.temperature_2m_max?.[0], current.temperature_2m || 0)),
    minTempC: Math.round(toNumber(payload.daily?.temperature_2m_min?.[0], current.temperature_2m || 0)),
    condition: `code:${toNumber(current.weather_code, 0)}`,
  };
}

async function fetchFromOpenWeather(lat, lng, apiKey) {
  const [currentResponse, forecastResponse] = await Promise.all([
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`),
    fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`),
  ]);

  if (!currentResponse.ok || !forecastResponse.ok) {
    throw new Error('OpenWeather provider returned an error.');
  }

  const currentPayload = await currentResponse.json();
  const forecastPayload = await forecastResponse.json();
  const entries = Array.isArray(forecastPayload.list) ? forecastPayload.list.slice(0, 8) : [];

  const rainChance24h = entries.length
    ? Math.round(
        entries.reduce((max, entry) => Math.max(max, toNumber(entry.pop, 0)), 0) * 100,
      )
    : 0;
  const rainMm24h = round(entries.reduce((sum, entry) => sum + toNumber(entry.rain?.['3h'], 0), 0));
  const maxTempC = Math.round(
    entries.reduce((max, entry) => Math.max(max, toNumber(entry.main?.temp_max, toNumber(currentPayload.main?.temp_max, 0))), toNumber(currentPayload.main?.temp_max, 0)),
  );
  const minTempC = Math.round(
    entries.reduce((min, entry) => Math.min(min, toNumber(entry.main?.temp_min, toNumber(currentPayload.main?.temp_min, 0))), toNumber(currentPayload.main?.temp_min, 0)),
  );

  return {
    provider: 'openweathermap',
    city: currentPayload.name || `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
    tempC: Math.round(toNumber(currentPayload.main?.temp, 0)),
    feelsLikeC: Math.round(toNumber(currentPayload.main?.feels_like, 0)),
    humidity: Math.round(toNumber(currentPayload.main?.humidity, 0)),
    windKmph: Math.round(toNumber(currentPayload.wind?.speed, 0) * 3.6),
    rainChance24h,
    rainMm24h,
    maxTempC,
    minTempC,
    condition: String(currentPayload.weather?.[0]?.description || 'weather'),
  };
}

export async function fetchWeatherSummary(lat, lng) {
  const latitude = toNumber(lat, NaN);
  const longitude = toNumber(lng, NaN);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const provider = String(process.env.WEATHER_PROVIDER || 'auto').toLowerCase();
  const openWeatherKey = String(process.env.OPENWEATHER_API_KEY || '').trim();

  if ((provider === 'openweather' || provider === 'auto') && openWeatherKey) {
    try {
      return await fetchFromOpenWeather(latitude, longitude, openWeatherKey);
    } catch {
      if (provider === 'openweather') {
        throw new Error('OpenWeather data fetch failed.');
      }
    }
  }

  return fetchFromOpenMeteo(latitude, longitude);
}

