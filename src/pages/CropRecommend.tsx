import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, CloudSun, Droplets, Leaf, Sprout } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { api, type CropRecommendationResult } from '../services/api';
import { createAlert, shouldTriggerAlert } from '../utils/alertEngine';
import { pushBrowserNotification } from '../utils/browserNotifications';

type SoilType = 'black' | 'red' | 'loamy' | 'sandy' | 'clay' | 'silt';
type SeasonType = 'kharif' | 'rabi' | 'zaid';

type FormState = {
  soilType: SoilType;
  season: SeasonType;
  temperatureC: number;
  rainfallMm: number;
  landSizeAcres: number;
};

const DEFAULT_FORM: FormState = {
  soilType: 'loamy',
  season: 'kharif',
  temperatureC: 30,
  rainfallMm: 850,
  landSizeAcres: 2,
};

const SOIL_OPTIONS: SoilType[] = ['black', 'red', 'loamy', 'sandy', 'clay', 'silt'];
const SEASON_OPTIONS: SeasonType[] = ['kharif', 'rabi', 'zaid'];

async function fetchCurrentWeatherContext(): Promise<{ temperatureC: number; rainfallMm: number }> {
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000,
    });
  });

  const lat = position.coords.latitude;
  const lng = position.coords.longitude;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m&daily=precipitation_sum&forecast_days=7&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Weather fetch failed');

  const payload = await response.json();
  const temp = Number(payload.current?.temperature_2m ?? 30);
  const weeklyRain = payload.daily?.precipitation_sum || [];
  const rainMm = Number(weeklyRain.reduce((sum: number, item: number) => sum + Number(item || 0), 0));

  return {
    temperatureC: Math.round(temp),
    rainfallMm: Math.max(100, Math.round(rainMm * 4)),
  };
}

function riskStyles(risk: string) {
  if (risk === 'High') return 'bg-red-100 text-red-700 border-red-200';
  if (risk === 'Medium') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-green-100 text-green-700 border-green-200';
}

function formatCurrency(value: number) {
  return `₹${new Intl.NumberFormat('en-IN').format(value)}`;
}

export function CropRecommend() {
  const { t } = useLanguage();
  const { simpleMode } = useAppSettings();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [result, setResult] = useState<CropRecommendationResult | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; topCrop: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [error, setError] = useState('');
  const [showDetailed, setShowDetailed] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const historyResponse = await api.getCropRecommendationHistory();
        const compact = historyResponse.history.map((item) => ({
          id: item.id,
          topCrop: item.topCrop,
          createdAt: item.createdAt,
        }));
        setHistory(compact);
      } catch {
        setHistory([]);
      }
    };

    void loadHistory();
  }, []);

  const topRecommendation = useMemo(() => result?.recommendations?.[0], [result]);

  const notify = (title: string, body: string) => {
    void pushBrowserNotification({
      type: 'crop',
      level: 'medium',
      title,
      message: body,
      path: '/crop-recommend',
    });
  };

  const handleAutofillWeather = async () => {
    setFetchingWeather(true);
    setError('');
    try {
      const weatherContext = await fetchCurrentWeatherContext();
      setForm((prev) => ({ ...prev, ...weatherContext }));
    } catch {
      setError('Could not auto-fetch weather. Please enter temperature and rainfall manually.');
    } finally {
      setFetchingWeather(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await api.recommendCrop(form);
      setResult(data);

      if (data.recommendations.length) {
        const best = data.recommendations[0];
        const alertMessage = `${best.cropLabel} (${best.suitabilityScore}%) | ${best.riskLevel} risk`;
        const level = best.riskLevel === 'High' ? 'high' : best.riskLevel === 'Medium' ? 'medium' : 'low';
        const signature = `crop-${form.soilType}-${form.season}-${best.cropKey}-${best.riskLevel}`;
        if (level !== 'low' || best.suitabilityScore >= 88) {
          if (shouldTriggerAlert(signature, level)) {
            notify(
              `${best.cropLabel} planning signal`,
              `Suitability ${best.suitabilityScore}%. ${best.riskLevel} risk. ${best.whyRecommended}`,
            );
            createAlert({ type: 'crop', level, message: alertMessage });
            void api.ingestAlert({
              type: 'crop',
              level,
              title: 'Crop Recommendation Update',
              message: alertMessage,
              source: 'web-farmer-crop',
              metadata: {
                soilType: form.soilType,
                season: form.season,
                temperatureC: form.temperatureC,
                rainfallMm: form.rainfallMm,
                fingerprint: signature,
              },
            });
          }
        }
      }

      const historyResponse = await api.getCropRecommendationHistory();
      setHistory(
        historyResponse.history.map((item) => ({
          id: item.id,
          topCrop: item.topCrop,
          createdAt: item.createdAt,
        })),
      );
    } catch {
      setError('Recommendation service unavailable. Please verify backend API and retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl p-4">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
          <Sprout className="text-green-600" />
          {t('crop_recommendation')}
        </h1>
        <button
          type="button"
          onClick={() => setShowDetailed((prev) => !prev)}
          className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
        >
          {showDetailed ? 'Simple View' : 'Detailed View'}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-1 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Recommendation Inputs</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">{t('select_soil')}</label>
              <select
                value={form.soilType}
                onChange={(event) => setForm((prev) => ({ ...prev, soilType: event.target.value as SoilType }))}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-green-500 focus:outline-none"
              >
                {SOIL_OPTIONS.map((soil) => (
                  <option key={soil} value={soil}>
                    {t(soil)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">{t('select_season')}</label>
              <select
                value={form.season}
                onChange={(event) => setForm((prev) => ({ ...prev, season: event.target.value as SeasonType }))}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-green-500 focus:outline-none"
              >
                {SEASON_OPTIONS.map((season) => (
                  <option key={season} value={season}>
                    {t(season)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Temperature (°C)</label>
              <input
                type="number"
                value={form.temperatureC}
                onChange={(event) => setForm((prev) => ({ ...prev, temperatureC: Number(event.target.value) }))}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Seasonal Rainfall (mm)</label>
              <input
                type="number"
                value={form.rainfallMm}
                onChange={(event) => setForm((prev) => ({ ...prev, rainfallMm: Number(event.target.value) }))}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Land Size (acres)</label>
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={form.landSizeAcres}
                onChange={(event) => setForm((prev) => ({ ...prev, landSizeAcres: Number(event.target.value) }))}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={handleAutofillWeather}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              <CloudSun size={18} />
              {fetchingWeather ? 'Fetching weather...' : 'Use current weather'}
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full rounded-xl bg-green-600 px-4 py-3 text-base font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
            >
              {loading ? t('analyzing') : t('get_recommendation')}
            </button>

            {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          </div>
        </section>

        <section className="lg:col-span-2 space-y-4">
          {topRecommendation && (
            <article className="rounded-2xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-5 shadow-sm">
              <p className="text-sm font-semibold text-green-700">Top Recommendation</p>
              <h3 className="mt-1 text-3xl font-extrabold text-gray-900">{t(topRecommendation.cropKey)}</h3>

              <div className={`mt-3 inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${riskStyles(topRecommendation.riskLevel)}`}>
                Suitability {topRecommendation.suitabilityScore}% | Risk {topRecommendation.riskLevel}
              </div>

              <p className="mt-3 text-gray-700">
                <strong>Why:</strong> {topRecommendation.whyRecommended}
              </p>
              <p className="mt-2 text-gray-700">
                <strong>Expected yield:</strong> {topRecommendation.expectedYieldQPerAcre}
              </p>
              <p className="mt-2 text-gray-700">
                <strong>Profit estimate:</strong> {formatCurrency(topRecommendation.economics.netProfit)} ({formatCurrency(topRecommendation.economics.grossIncome)} gross - {formatCurrency(topRecommendation.economics.estimatedCost)} cost)
              </p>
            </article>
          )}

          {result?.advisory?.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <p className="mb-2 flex items-center gap-2 font-semibold">
                <CircleAlert size={18} /> Actionable Advice
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {result.advisory.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result?.recommendations?.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {result.recommendations.map((crop) => (
                <article key={crop.cropKey} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xl font-bold text-gray-900">{t(crop.cropKey)}</h4>
                    <span className={`rounded-full border px-2 py-1 text-xs font-bold ${riskStyles(crop.riskLevel)}`}>
                      {crop.suitabilityScore}%
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-gray-700">
                    <strong>Risk:</strong> {crop.riskLevel}
                  </p>
                  <p className="mt-1 text-sm text-gray-700">
                    <strong>{t('yield')}:</strong> {crop.expectedYieldQPerAcre}
                  </p>

                  {!simpleMode || showDetailed ? (
                    <div className="mt-3 space-y-2 text-sm text-gray-700">
                      <p className="flex items-start gap-2"><Droplets size={16} className="mt-0.5 text-blue-500" /> {crop.requiredWater}</p>
                      <p className="flex items-start gap-2"><Leaf size={16} className="mt-0.5 text-green-600" /> {crop.requiredFertilizer}</p>
                      <p><strong>Why recommended:</strong> {crop.whyRecommended}</p>
                      <p><strong>Risk note:</strong> {crop.riskNote}</p>
                      <p><strong>Profit:</strong> {formatCurrency(crop.economics.netProfit)}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-gray-600">Tap detailed view for water, fertilizer, and risk management guidance.</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
              Enter farm inputs to get AI-powered crop recommendations with suitability and profit estimates.
            </div>
          )}

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-bold text-gray-900">Recent recommendation queries</h3>
            {history.length ? (
              <div className="space-y-2 text-sm text-gray-700">
                {history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <span>Top crop: {t(item.topCrop)}</span>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No recommendation history found yet.</p>
            )}
          </section>
        </section>
      </div>
    </div>
  );
}
