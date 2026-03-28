import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CloudRain, Droplets, LocateFixed, Thermometer, Wind } from 'lucide-react';
import { api, WeatherDecisionResponse } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { createAlert, shouldTriggerAlert } from '../utils/alertEngine';

type CachedWeather = WeatherDecisionResponse;

const CACHE_KEY = 'weatherDecisionCacheV2';

const WEATHER_CODE_MAP: Record<number, string> = {
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
  80: 'Rain Showers',
  81: 'Rain Showers',
  82: 'Violent Showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Thunderstorm',
};

function getProfileCrop(): string {
  try {
    const raw = localStorage.getItem('farmerProfile');
    if (!raw) return '';
    const profile = JSON.parse(raw) as { crops?: string };
    if (!profile.crops) return '';
    return profile.crops.split(',')[0]?.trim() || '';
  } catch {
    return '';
  }
}

function buildLocalDecision(args: {
  city: string;
  latitude: number;
  longitude: number;
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windKmph: number;
  weatherCode: number;
  rainChance24h: number;
  rainMm24h: number;
  rainMm7d: number;
  maxTemp: number;
  minTemp: number;
  crop: string;
}): WeatherDecisionResponse {
  const alerts: WeatherDecisionResponse['decisions']['alerts'] = [];
  const actions: string[] = [];

  let irrigationRecommendation: WeatherDecisionResponse['decisions']['irrigationRecommendation'] = {
    status: 'normal',
    message: 'Maintain your regular irrigation schedule. Verify field moisture before each cycle.',
  };

  if (args.rainChance24h >= 70 || args.rainMm24h >= 12) {
    irrigationRecommendation = {
      status: 'hold',
      message: 'Hold irrigation today. Rain chance is high and waterlogging risk is elevated.',
    };
    alerts.push({
      type: 'weather',
      level: 'high',
      title: 'High Rain Advisory',
      message: 'Avoid irrigation and open drainage channels in low-lying plots.',
    });
    actions.push('Skip irrigation for the next 24 hours.');
    actions.push('Clear drainage channels to prevent root-zone waterlogging.');
  } else if (args.rainChance24h <= 25 && args.tempC >= 33) {
    irrigationRecommendation = {
      status: 'increase',
      message: 'Low rain forecast with warm weather. Shift to split irrigation in cool hours.',
    };
    actions.push('Use early-morning and evening irrigation to reduce evaporation losses.');
  }

  let heatAlert: WeatherDecisionResponse['decisions']['heatAlert'] = null;
  if (args.tempC >= 38 || args.feelsLikeC >= 40) {
    heatAlert = {
      severity: args.tempC >= 41 ? 'high' : 'medium',
      message: 'Heat stress risk for crop canopy and root-zone moisture.',
      protectionTips: [
        'Apply organic mulch to reduce water loss.',
        'Avoid foliar spray during noon hours.',
        'Use short cooling irrigation in the morning where possible.',
      ],
    };
    alerts.push({
      type: 'weather',
      level: heatAlert.severity,
      title: 'Heat Stress Advisory',
      message: heatAlert.message,
    });
    actions.push('Protect crop from heat stress with mulch and cool-hour irrigation.');
  }

  let sowingWindow: WeatherDecisionResponse['decisions']['sowingWindow'] = {
    status: 'watch',
    message: 'Wait and monitor 3-day weather before new sowing.',
    bestDays: [],
  };

  if (args.rainChance24h >= 45 && args.rainChance24h <= 70 && args.tempC >= 22 && args.tempC <= 34) {
    sowingWindow = {
      status: 'good',
      message: 'Sowing window is favorable for the coming 2-4 days.',
      bestDays: ['Day 2', 'Day 3', 'Day 4'],
    };
  } else if (args.rainChance24h > 80 || args.tempC > 39) {
    sowingWindow = {
      status: 'poor',
      message: 'Avoid fresh sowing now due to weather stress.',
      bestDays: [],
    };
    actions.push('Postpone sowing and re-check forecast after 48 hours.');
  }

  if (args.crop.toLowerCase().includes('rice')) {
    actions.push('Rice fields: maintain inlet-outlet channels for rainwater control.');
  }
  if (args.crop.toLowerCase().includes('cotton')) {
    actions.push('Cotton: avoid spray if wind speed remains above 25 km/h.');
  }
  if (!args.crop) {
    actions.push('Set your primary crop in profile for crop-specific weather advisories.');
  }

  if (!actions.length) {
    actions.push('No major risk today. Continue your planned field operations.');
  }

  return {
    city: args.city,
    latitude: args.latitude,
    longitude: args.longitude,
    current: {
      tempC: args.tempC,
      feelsLikeC: args.feelsLikeC,
      humidity: args.humidity,
      windKmph: args.windKmph,
      weatherCode: args.weatherCode,
      weatherLabel: WEATHER_CODE_MAP[args.weatherCode] || 'Weather',
    },
    forecast: {
      rainChance24h: args.rainChance24h,
      rainMm24h: args.rainMm24h,
      rainMm7d: args.rainMm7d,
      maxTemp: args.maxTemp,
      minTemp: args.minTemp,
    },
    decisions: {
      irrigationRecommendation,
      heatAlert,
      sowingWindow,
      todayActions: [...new Set(actions)].slice(0, 8),
      alerts,
    },
    fetchedAt: new Date().toISOString(),
    source: 'direct-fallback',
  };
}

async function getLocationName(latitude: number, longitude: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
    );
    if (!response.ok) return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
    const data = await response.json();
    const address = data?.address || {};
    return (
      address.city ||
      address.town ||
      address.village ||
      address.county ||
      `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`
    );
  } catch {
    return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
  }
}

async function fallbackWeatherDecision(latitude: number, longitude: number, crop: string) {
  const city = await getLocationName(latitude, longitude);
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=precipitation_probability,precipitation&daily=temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=auto`;
  const response = await fetch(weatherUrl);

  if (!response.ok) {
    throw new Error('Unable to fetch fallback weather data.');
  }

  const payload = await response.json();
  const current = payload.current;
  const hourlyTimes: string[] = payload.hourly?.time || [];
  const hourlyChance: number[] = payload.hourly?.precipitation_probability || [];
  const hourlyMm: number[] = payload.hourly?.precipitation || [];
  const nowIndex = Math.max(0, hourlyTimes.indexOf(current?.time));
  const chance24 = hourlyChance.slice(nowIndex, nowIndex + 24);
  const mm24 = hourlyMm.slice(nowIndex, nowIndex + 24);

  return buildLocalDecision({
    city,
    latitude,
    longitude,
    tempC: Math.round(Number(current.temperature_2m || 0)),
    feelsLikeC: Math.round(Number(current.apparent_temperature || 0)),
    humidity: Math.round(Number(current.relative_humidity_2m || 0)),
    windKmph: Math.round(Number(current.wind_speed_10m || 0)),
    weatherCode: Number(current.weather_code || 0),
    rainChance24h: Math.round(chance24.length ? Math.max(...chance24) : 0),
    rainMm24h: Math.round(mm24.reduce((sum, item) => sum + Number(item || 0), 0) * 10) / 10,
    rainMm7d: Math.round(hourlyMm.slice(0, 24 * 7).reduce((sum, item) => sum + Number(item || 0), 0) * 10) / 10,
    maxTemp: Math.round(Number(payload.daily?.temperature_2m_max?.[0] || current.temperature_2m || 0)),
    minTemp: Math.round(Number(payload.daily?.temperature_2m_min?.[0] || current.temperature_2m || 0)),
    crop,
  });
}

function pushBrowserNotification(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
    return;
  }
  if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification(title, { body });
      }
    });
  }
}

export function Weather() {
  const { language, t } = useLanguage();
  const [data, setData] = useState<WeatherDecisionResponse | null>(null);
  const [aiAdvice, setAiAdvice] = useState('');
  const [aiAdviceLoading, setAiAdviceLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [detailedView, setDetailedView] = useState(false);
  const [webhookInput, setWebhookInput] = useState(localStorage.getItem('managerWebhookUrl') || '');
  const lastNotificationRef = useRef('');

  const crop = useMemo(() => getProfileCrop(), []);

  const requestAiAdvice = async (decision: WeatherDecisionResponse) => {
    setAiAdviceLoading(true);
    try {
      const response = await api.askAi({
        query: 'Give concise farming actions for the next 24 hours using current weather conditions.',
        lat: decision.latitude,
        lng: decision.longitude,
        crop: crop || undefined,
      });
      setAiAdvice(response.answer);
    } catch {
      setAiAdvice('');
    } finally {
      setAiAdviceLoading(false);
    }
  };

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const forwardToManager = async (message: string) => {
      const managerWebhookUrl = localStorage.getItem('managerWebhookUrl');
      if (!managerWebhookUrl) return;

      try {
        await fetch(managerWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'weather',
            title: 'Smart Agriculture Alert',
            body: message,
            time: new Date().toISOString(),
          }),
        });
      } catch {
        // Best-effort forwarding for low-connectivity deployments.
      }
    };

    const syncAndNotifyAlerts = async (decision: WeatherDecisionResponse) => {
      const alertText = decision.decisions.alerts.map((item) => `${item.title}: ${item.message}`).join(' | ');
      if (!alertText) return;

      const signature = `${decision.city}-${alertText}`;
      if (lastNotificationRef.current === signature) return;
      lastNotificationRef.current = signature;

      const aggregateLevel = decision.decisions.alerts.some((item) => item.level === 'high')
        ? 'high'
        : decision.decisions.alerts.some((item) => item.level === 'medium')
        ? 'medium'
        : 'low';
      const signatureKey = `weather-${decision.city}-${aggregateLevel}-${Math.round(decision.forecast.rainChance24h / 10)}-${Math.round(
        decision.current.tempC / 2,
      )}`;

      if (shouldTriggerAlert(signatureKey, aggregateLevel)) {
        pushBrowserNotification(
          language === 'te' ? 'ఈరోజు వ్యవసాయ అలర్ట్' : 'Today Farming Alert',
          `${decision.city}: ${alertText}`,
        );
      }

      decision.decisions.alerts.forEach((item) => {
        const itemSignature = `weather-${decision.city}-${item.title}-${Math.round(decision.forecast.rainChance24h / 10)}-${Math.round(
          decision.current.tempC / 2,
        )}`;
        if (shouldTriggerAlert(itemSignature, item.level)) {
          createAlert({
            type: 'weather',
            level: item.level,
            message: `${decision.city}: ${item.message}`,
          });
        }
      });

      await Promise.allSettled([
        ...decision.decisions.alerts.map((item) => {
          const fingerprint = `weather-${decision.city}-${item.title}-${Math.round(decision.forecast.rainChance24h / 10)}-${Math.round(
            decision.current.tempC / 2,
          )}`;
          return api.ingestAlert({
            type: 'weather',
            level: item.level,
            title: item.title,
            message: `${decision.city}: ${item.message}`,
            source: 'web-farmer-weather',
            metadata: {
              rainChance24h: decision.forecast.rainChance24h,
              tempC: decision.current.tempC,
              crop,
              fingerprint,
            },
          });
        }),
        forwardToManager(`${decision.city}: ${alertText}`),
      ]);
    };

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 600000,
          });
        });

        const { latitude, longitude } = position.coords;
        let result: WeatherDecisionResponse;

        try {
          result = await api.getWeatherDecision(latitude, longitude, crop);
        } catch {
          result = await fallbackWeatherDecision(latitude, longitude, crop);
          setError(language === 'te' ? 'బ్యాక్‌ఎండ్ అందుబాటులో లేదు. ప్రత్యక్ష వాతావరణ డేటాతో కొనసాగిస్తోంది.' : 'Backend unavailable. Using direct weather fallback.');
        }

        setData(result);
        void requestAiAdvice(result);
        localStorage.setItem(CACHE_KEY, JSON.stringify(result));
        await syncAndNotifyAlerts(result);
      } catch {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const cachedDecision = JSON.parse(cached) as CachedWeather;
          setData(cachedDecision);
          setError(language === 'te' ? 'ఆఫ్‌లైన్ మోడ్: చివరిసారి సేవ్ అయిన డేటా చూపిస్తున్నారు.' : 'Offline mode: showing last synced weather decision.');
        } else {
          setError(t('weather_load_error'));
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [crop, language, t]);

  if (loading) {
    return <div className="p-8 text-center">{t('analyzing')}</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-600">{error || t('weather_load_error')}</div>;
  }

  const weatherLabel = data.current.weatherLabel || WEATHER_CODE_MAP[data.current.weatherCode] || 'Weather';
  const irrigationClass =
    data.decisions.irrigationRecommendation.status === 'hold'
      ? 'border-red-200 bg-red-50 text-red-800'
      : data.decisions.irrigationRecommendation.status === 'increase'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">{t('weather_forecast')}</h1>
        <button
          type="button"
          onClick={() => setDetailedView((prev) => !prev)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          {detailedView
            ? language === 'te'
              ? 'సరళ దృశ్యం'
              : 'Simple View'
            : language === 'te'
            ? 'వివర దృశ్యం'
            : 'Detailed View'}
        </button>
      </div>

      {isOffline && (
        <p className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          {language === 'te'
            ? 'ఆఫ్‌లైన్ మోడ్ అందుబాటులో ఉంది. చివరిసారి సింక్ అయిన డేటా ఉపయోగించబడుతుంది.'
            : 'Offline mode enabled. Last synced advisory is used in low-network areas.'}
        </p>
      )}

      {error && <p className="mb-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">{error}</p>}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-6 text-white shadow-lg">
          <div className="mb-4 flex items-center gap-2 text-blue-100">
            <LocateFixed size={18} />
            <span className="text-sm">
              {data.city} ({data.latitude.toFixed(2)}, {data.longitude.toFixed(2)})
            </span>
          </div>
          <p className="text-lg opacity-90">{weatherLabel}</p>
          <h2 className="mb-2 text-5xl font-bold">{data.current.tempC}°C</h2>
          <p className="text-sm text-blue-100">
            {t('feels_like')}: {data.current.feelsLikeC}°C | {t('last_updated')}: {new Date(data.fetchedAt).toLocaleTimeString()}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-white/20 p-2">
              <Thermometer className="mr-1 inline" size={16} />
              {t('humidity')}: {data.current.humidity}%
            </div>
            <div className="rounded-lg bg-white/20 p-2">
              <Wind className="mr-1 inline" size={16} />
              {t('wind_speed')}: {data.current.windKmph} km/h
            </div>
            <div className="rounded-lg bg-white/20 p-2">
              <CloudRain className="mr-1 inline" size={16} />
              {t('rain_chance')}: {data.forecast.rainChance24h}%
            </div>
            <div className="rounded-lg bg-white/20 p-2">
              <Droplets className="mr-1 inline" size={16} />
              Rain (24h): {data.forecast.rainMm24h} mm
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <h2 className="mb-2 text-xl font-bold text-emerald-900">
            {language === 'te' ? 'ఈ రోజు ఏమి చేయాలి?' : 'What to do today'}
          </h2>
          <p className="mb-3 text-sm text-emerald-700">
            {language === 'te'
              ? 'ఇది ప్రత్యక్ష వాతావరణ డేటా ఆధారంగా రూపొందించిన చర్యల జాబితా.'
              : 'Action checklist generated from real-time weather and farm context.'}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-emerald-900">
            {data.decisions.todayActions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className={`rounded-xl border p-4 ${irrigationClass}`}>
          <h3 className="mb-1 font-bold">{language === 'te' ? 'పారుదల సూచన' : 'Irrigation Recommendation'}</h3>
          <p className="text-sm">{data.decisions.irrigationRecommendation.message}</p>
        </div>

        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-orange-900">
          <h3 className="mb-1 font-bold">{language === 'te' ? 'ఉష్ణోగ్రత రక్షణ అలర్ట్' : 'Heat Protection Alert'}</h3>
          {data.decisions.heatAlert ? (
            <>
              <p className="text-sm">{data.decisions.heatAlert.message}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                {data.decisions.heatAlert.protectionTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm">{language === 'te' ? 'ఈరోజు తీవ్రమైన వేడి ప్రమాదం లేదు.' : 'No severe heat stress risk today.'}</p>
          )}
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-900">
          <h3 className="mb-1 font-bold">{language === 'te' ? 'విత్తనాల విత్తే సమయం' : 'Sowing Window Prediction'}</h3>
          <p className="text-sm">{data.decisions.sowingWindow.message}</p>
          {data.decisions.sowingWindow.bestDays.length > 0 && (
            <p className="mt-2 text-xs font-semibold">
              {language === 'te' ? 'సరైన రోజులు:' : 'Suggested days:'} {data.decisions.sowingWindow.bestDays.join(', ')}
            </p>
          )}
        </div>
      </div>

      {data.decisions.alerts.length > 0 && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <h3 className="mb-2 flex items-center gap-2 font-bold">
            <AlertTriangle size={18} />
            {language === 'te' ? 'సృష్టించిన అలర్ట్లు' : 'Generated Alerts'}
          </h3>
          <ul className="space-y-1 text-sm">
            {data.decisions.alerts.map((item) => (
              <li key={`${item.title}-${item.message}`}>• {item.title}: {item.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 rounded-xl border border-[#d3e3cf] bg-[linear-gradient(130deg,#f5fff1,#ebf8e7)] p-4 text-[#21452a]">
        <h3 className="mb-2 font-bold">
          {language === 'te' ? 'AI వాతావరణ సూచన' : 'AI weather-aware suggestion'}
        </h3>
        {aiAdviceLoading ? (
          <p className="text-sm text-[#3b6742]">{language === 'te' ? 'AI సూచన సిద్ధమవుతుంది...' : 'Preparing AI suggestion...'}</p>
        ) : aiAdvice ? (
          <p className="whitespace-pre-wrap text-sm leading-6 text-[#2b4f2f]">{aiAdvice}</p>
        ) : (
          <p className="text-sm text-[#3b6742]">
            {language === 'te'
              ? 'AI సూచన లభించలేదు. సిస్టమ్ వాతావరణ నియమాలనే ఉపయోగిస్తోంది.'
              : 'AI suggestion unavailable right now. Weather decision rules are still active.'}
          </p>
        )}
      </div>

      {detailedView && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-2 font-bold text-gray-900">{language === 'te' ? 'వివరమైన అంచనా' : 'Detailed Forecast Context'}</h3>
          <div className="grid gap-2 text-sm text-gray-700 md:grid-cols-2">
            <p>24h rain probability: {data.forecast.rainChance24h}%</p>
            <p>24h expected rainfall: {data.forecast.rainMm24h} mm</p>
            <p>7-day rainfall outlook: {data.forecast.rainMm7d} mm</p>
            <p>
              Daily temp range: {data.forecast.minTemp}°C to {data.forecast.maxTemp}°C
            </p>
            <p>Data source: {data.source}</p>
            <p>Primary crop context: {crop || (language === 'te' ? 'సెట్ కాలేదు' : 'Not set')}</p>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-2 font-semibold text-gray-800">{t('manager_alert_setup')}</h3>
        <p className="mb-3 text-xs text-gray-500">{t('manager_alert_setup_hint')}</p>
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            value={webhookInput}
            onChange={(event) => setWebhookInput(event.target.value)}
            placeholder="https://your-webhook-url"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => localStorage.setItem('managerWebhookUrl', webhookInput.trim())}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {t('save_webhook')}
          </button>
        </div>
      </div>
    </div>
  );
}
