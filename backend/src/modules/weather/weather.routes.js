import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const weatherQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  crop: z.string().trim().min(1).max(80).optional(),
});

const WEATHER_CODE_MAP = {
  0: 'Clear',
  1: 'Mostly Clear',
  2: 'Partly Cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Fog',
  51: 'Light Drizzle',
  53: 'Drizzle',
  55: 'Dense Drizzle',
  61: 'Light Rain',
  63: 'Rain',
  65: 'Heavy Rain',
  71: 'Light Snow',
  73: 'Snow',
  75: 'Heavy Snow',
  80: 'Rain Showers',
  81: 'Rain Showers',
  82: 'Violent Showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Thunderstorm',
};

function getSeason(monthIndex) {
  if (monthIndex >= 5 && monthIndex <= 9) return 'kharif';
  if (monthIndex >= 10 || monthIndex <= 1) return 'rabi';
  return 'zaid';
}

function cropSpecificTips(crop) {
  const key = String(crop || '').toLowerCase();
  if (!key) return [];

  if (key.includes('rice')) {
    return ['Drain excess standing water before applying urea top dressing.', 'Scout for blast after high humidity and intermittent rain.'];
  }
  if (key.includes('cotton')) {
    return ['Avoid pesticide spray during high wind periods.', 'Monitor pink bollworm traps twice this week due to warm nights.'];
  }
  if (key.includes('maize')) {
    return ['Protect tasseling stage from heat stress with early morning irrigation.', 'Check for fall armyworm after cloudy humid weather.'];
  }
  if (key.includes('chilli')) {
    return ['Use light mulch to stabilize root-zone moisture.', 'Avoid overhead irrigation to reduce fungal leaf spot risk.'];
  }
  return ['Follow stage-wise irrigation and nutrient schedule for your crop.'];
}

function buildDecision(snapshot, crop) {
  const todayActions = [];
  const alerts = [];
  const next7RainMm = Math.round(snapshot.rainMm7d || 0);
  const monthIndex = new Date().getMonth();
  const season = getSeason(monthIndex);

  let irrigationRecommendation = {
    status: 'normal',
    message: 'Continue planned irrigation cycle with field moisture check.',
  };

  if (snapshot.rainChance24h >= 70 || snapshot.rainMm24h >= 12) {
    irrigationRecommendation = {
      status: 'hold',
      message: 'Hold irrigation for today. Rain likelihood is high and overwatering risk is elevated.',
    };
    alerts.push({
      type: 'weather',
      level: 'high',
      title: 'High Rain Advisory',
      message: 'Rain probability is high. Avoid irrigation and open drainage channels.',
    });
    todayActions.push('Skip irrigation for the next 24 hours.');
    todayActions.push('Clean drainage paths to avoid root-zone waterlogging.');
  } else if (snapshot.rainChance24h <= 25 && snapshot.tempC >= 33) {
    irrigationRecommendation = {
      status: 'increase',
      message: 'Low rain outlook and warm conditions. Use split irrigation (morning/evening).',
    };
    todayActions.push('Irrigate during early morning or late evening to reduce evaporation loss.');
  } else {
    todayActions.push('Maintain regular irrigation but confirm topsoil moisture before watering.');
  }

  let heatAlert = null;
  if (snapshot.tempC >= 38 || snapshot.feelsLikeC >= 40) {
    heatAlert = {
      severity: snapshot.tempC >= 41 ? 'high' : 'medium',
      message: 'Heat stress risk today. Protect crop canopy and root moisture.',
      protectionTips: [
        'Apply light mulch to reduce moisture loss.',
        'Prefer drip/furrow irrigation in cool hours.',
        'Postpone pesticide spray until wind and heat reduce.',
      ],
    };
    alerts.push({
      type: 'weather',
      level: heatAlert.severity === 'high' ? 'high' : 'medium',
      title: 'Heat Stress Advisory',
      message: heatAlert.message,
    });
    todayActions.push('Use mulch and cool-hour irrigation to protect roots from heat stress.');
  }

  let sowingWindow = {
    status: 'watch',
    message: 'Monitor rain and temperature for the next 3-5 days before sowing.',
    bestDays: [] ,
  };

  if (snapshot.rainChance24h >= 45 && snapshot.rainChance24h <= 70 && snapshot.tempC >= 22 && snapshot.tempC <= 34) {
    sowingWindow = {
      status: 'good',
      message: 'Sowing window looks favorable over the next few days.',
      bestDays: ['Day 2', 'Day 3', 'Day 4'],
    };
  } else if (snapshot.rainChance24h > 80 || snapshot.tempC > 39) {
    sowingWindow = {
      status: 'poor',
      message: 'Avoid new sowing now due to weather stress. Reassess after 2-3 days.',
      bestDays: [],
    };
  }

  const cropTips = cropSpecificTips(crop);
  todayActions.push(...cropTips);
  if (next7RainMm > 80 && season === 'kharif') {
    todayActions.push('Heavy weekly rain expected: prefer raised-bed sowing and seed treatment.');
  }

  return {
    irrigationRecommendation,
    heatAlert,
    sowingWindow,
    todayActions: [...new Set(todayActions)].slice(0, 8),
    alerts,
  };
}

async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
      headers: { 'User-Agent': 'smart-agriculture-platform/1.0' },
    });

    if (!response.ok) {
      return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
    }

    const data = await response.json();
    const address = data?.address || {};
    return address.city || address.town || address.village || address.county || `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  } catch {
    return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  }
}

async function fetchWeatherSnapshot(lat, lng) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=precipitation_probability,precipitation&daily=temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=auto`;
  const response = await fetch(weatherUrl);
  if (!response.ok) {
    throw new Error('Unable to fetch weather data from provider');
  }

  const payload = await response.json();
  const current = payload.current;
  const hourlyTimes = payload.hourly?.time || [];
  const hourlyRainChance = payload.hourly?.precipitation_probability || [];
  const hourlyRainMm = payload.hourly?.precipitation || [];
  const nowIso = current?.time;
  const nowIndex = Math.max(0, hourlyTimes.indexOf(nowIso));

  const rainChanceSlice = hourlyRainChance.slice(nowIndex, nowIndex + 24);
  const rainMmSlice = hourlyRainMm.slice(nowIndex, nowIndex + 24);

  const rainChance24h = rainChanceSlice.length ? Math.max(...rainChanceSlice) : 0;
  const rainMm24h = rainMmSlice.length ? rainMmSlice.reduce((sum, value) => sum + Number(value || 0), 0) : 0;
  const rainMm7d = Array.isArray(hourlyRainMm)
    ? hourlyRainMm.slice(0, 24 * 7).reduce((sum, value) => sum + Number(value || 0), 0)
    : 0;

  return {
    tempC: Math.round(Number(current.temperature_2m || 0)),
    feelsLikeC: Math.round(Number(current.apparent_temperature || 0)),
    humidity: Math.round(Number(current.relative_humidity_2m || 0)),
    windKmph: Math.round(Number(current.wind_speed_10m || 0)),
    weatherCode: Number(current.weather_code || 0),
    weatherLabel: WEATHER_CODE_MAP[current.weather_code] || 'Weather',
    rainChance24h: Math.round(rainChance24h),
    rainMm24h: Math.round(rainMm24h * 10) / 10,
    rainMm7d: Math.round(rainMm7d * 10) / 10,
    maxTemp: Math.round(Number(payload.daily?.temperature_2m_max?.[0] || current.temperature_2m || 0)),
    minTemp: Math.round(Number(payload.daily?.temperature_2m_min?.[0] || current.temperature_2m || 0)),
  };
}

router.get('/current', validateRequest({ query: weatherQuerySchema }), async (req, res) => {
  const lat = Number(req.query.lat || 17.385);
  const lng = Number(req.query.lng || 78.4867);
  const crop = typeof req.query.crop === 'string' ? req.query.crop : '';

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ message: 'Invalid coordinates' });
  }

  try {
    const [city, snapshot] = await Promise.all([reverseGeocode(lat, lng), fetchWeatherSnapshot(lat, lng)]);
    const decision = buildDecision(snapshot, crop);

    return res.json({
      city,
      latitude: lat,
      longitude: lng,
      current: {
        tempC: snapshot.tempC,
        feelsLikeC: snapshot.feelsLikeC,
        humidity: snapshot.humidity,
        windKmph: snapshot.windKmph,
        weatherCode: snapshot.weatherCode,
        weatherLabel: snapshot.weatherLabel,
      },
      forecast: {
        rainChance24h: snapshot.rainChance24h,
        rainMm24h: snapshot.rainMm24h,
        rainMm7d: snapshot.rainMm7d,
        maxTemp: snapshot.maxTemp,
        minTemp: snapshot.minTemp,
      },
      decisions: decision,
      fetchedAt: new Date().toISOString(),
      source: 'open-meteo',
    });
  } catch (error) {
    return res.status(502).json({
      message: 'Weather provider unavailable',
      detail: error?.message || 'Unknown weather provider error',
    });
  }
});

export const weatherRouter = router;
