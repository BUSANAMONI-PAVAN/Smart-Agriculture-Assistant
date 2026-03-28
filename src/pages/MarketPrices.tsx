import { useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, RefreshCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { api, MarketIntelligenceResponse, MarketQueryHistoryItem } from '../services/api';
import { createAlert } from '../utils/alertEngine';

const COMMODITIES = ['rice', 'cotton', 'chilli', 'soybean', 'maize', 'onion', 'turmeric', 'banana'];

function TrendVisualization({ data }: { data: MarketIntelligenceResponse['trendSeries'] }) {
  if (!data.length) return null;

  const values = data.map((item) => item.avgPrice);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 640;
  const height = 180;
  const padding = 24;

  const points = data
    .map((item, idx) => {
      const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
      const ratio = max === min ? 0.5 : (item.avgPrice - min) / (max - min);
      const y = height - padding - ratio * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const predicted = data
    .map((item, idx) => {
      const value = item.predictedPrice ?? item.avgPrice;
      const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
      const ratio = max === min ? 0.5 : (value - min) / (max - min);
      const y = height - padding - ratio * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-indigo-100 bg-indigo-50 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[620px] w-full" role="img" aria-label="Price trend chart">
        <polyline fill="none" stroke="#4f46e5" strokeWidth="3" points={points} />
        <polyline fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray="6 6" points={predicted} />
      </svg>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-700">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-600" /> Historical avg</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Predicted</span>
      </div>
    </div>
  );
}

function locateUser(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: 17.385, lng: 78.4867 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        resolve({ lat: 17.385, lng: 78.4867 });
      },
      { enableHighAccuracy: true, timeout: 6000 },
    );
  });
}

export function MarketPrices() {
  const { language, t } = useLanguage();
  const [commodity, setCommodity] = useState('rice');
  const [areaAcres, setAreaAcres] = useState('2');
  const [costPerAcre, setCostPerAcre] = useState('25000');
  const [detailed, setDetailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [marketData, setMarketData] = useState<MarketIntelligenceResponse | null>(null);
  const [history, setHistory] = useState<MarketQueryHistoryItem[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const title = language === 'te' ? 'మార్కెట్ ఇంటెలిజెన్స్' : 'Market Intelligence';

  const topMarkets = useMemo(() => {
    if (!marketData) return [];
    return marketData.markets.slice(0, 3);
  }, [marketData]);

  const refreshData = async () => {
    setLoading(true);
    setError('');

    try {
      const currentLocation = await locateUser();
      setLocation(currentLocation);
      const payload = {
        commodity,
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        areaAcres: Math.max(0.2, Number(areaAcres) || 2),
        costPerAcre: Math.max(1000, Number(costPerAcre) || 25000),
      };
      const response = await api.getMarketIntelligence(payload);
      setMarketData(response);
      await api.saveMarketQuery(payload);
      const historyResponse = await api.getMarketQueryHistory();
      setHistory(historyResponse.history || []);

      if (response.bestMarket) {
        createAlert({
          type: 'market',
          level: 'low',
          message: `${response.bestMarket.market}: expected net ₹${response.bestMarket.economics.netProfit.toLocaleString()}`,
        });
      }
    } catch {
      setError(language === 'te' ? 'మార్కెట్ డేటా లోడ్ కాలేదు. మళ్లీ ప్రయత్నించండి.' : 'Unable to load market intelligence. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshData();
  }, []);

  return (
    <div className="container mx-auto max-w-5xl p-4">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
          <TrendingUp className="text-indigo-600" />
          {title}
        </h1>
        <button
          type="button"
          onClick={refreshData}
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw size={16} />}
          {language === 'te' ? 'రిఫ్రెష్' : 'Refresh'}
        </button>
      </div>

      <div className="mb-5 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-4">
        <label className="text-sm font-semibold text-gray-700">
          {t('commodity')}
          <select value={commodity} onChange={(event) => setCommodity(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
            {COMMODITIES.map((item) => (
              <option key={item} value={item}>{t(item)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-gray-700">
          {language === 'te' ? 'భూమి (ఎకరాలు)' : 'Land (acres)'}
          <input className="mt-1 w-full rounded-lg border px-3 py-2" type="number" min="0.2" step="0.1" value={areaAcres} onChange={(event) => setAreaAcres(event.target.value)} />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          {language === 'te' ? 'ఎకరాకు ఖర్చు (₹)' : 'Cost per acre (₹)'}
          <input className="mt-1 w-full rounded-lg border px-3 py-2" type="number" min="1000" value={costPerAcre} onChange={(event) => setCostPerAcre(event.target.value)} />
        </label>
        <div className="flex items-end">
          <button type="button" onClick={refreshData} className="w-full rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white">
            {language === 'te' ? 'లాభం చూసి మార్కెట్ ఎంచుకోండి' : 'Get Best Market'}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {marketData && (
        <>
          <div className="mb-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">{language === 'te' ? 'సూచించిన మార్కెట్' : 'Best Market'}</p>
              <p className="mt-1 text-lg font-bold text-emerald-900">{marketData.bestMarket?.market || '-'}</p>
              <p className="text-sm text-emerald-800">₹{marketData.bestMarket?.modalPrice.toLocaleString() || '-'} / qtl</p>
              <p className="text-sm text-emerald-800">{language === 'te' ? 'అంచనా నికర లాభం' : 'Estimated net profit'}: ₹{marketData.bestMarket?.economics.netProfit.toLocaleString() || '-'}</p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase text-blue-700">{language === 'te' ? '7-రోజుల అంచనా ధర' : '7-Day Predicted Price'}</p>
              <p className="mt-1 text-lg font-bold text-blue-900">₹{marketData.futurePrediction.toLocaleString()} / qtl</p>
              <p className="text-sm text-blue-800">{language === 'te' ? 'ట్రెండ్ ఆధారిత ప్రాథమిక అంచనా' : 'Basic model based prediction'}</p>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-xs font-semibold uppercase text-indigo-700">{language === 'te' ? 'ప్రస్తుత లొకేషన్' : 'Current Location'}</p>
              <p className="mt-1 text-sm text-indigo-900">
                <span className="inline-flex items-center gap-1"><MapPin size={15} /> {location ? `${location.lat.toFixed(3)}, ${location.lng.toFixed(3)}` : '-'}</span>
              </p>
              <p className="text-sm text-indigo-800">{language === 'te' ? `సగటు దిగుబడి: ${marketData.yieldQPerAcre} క్వింటాళ్లు/ఎకరం` : `Avg yield: ${marketData.yieldQPerAcre} qtl/acre`}</p>
            </div>
          </div>

          <TrendVisualization data={marketData.trendSeries} />

          <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-bold text-gray-900">{language === 'te' ? 'ఈరోజు ఏమి చేయాలి?' : 'What to do today?'}</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              {marketData.insights.map((line, index) => (
                <li key={index} className="rounded-md bg-gray-50 px-3 py-2">{line}</li>
              ))}
            </ul>
          </div>

          <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{language === 'te' ? 'టాప్ మార్కెట్లు' : 'Top Markets'}</h2>
              <button type="button" onClick={() => setDetailed((prev) => !prev)} className="text-sm font-semibold text-indigo-700">
                {detailed ? (language === 'te' ? 'సరళ వీక్షణ' : 'Simple View') : (language === 'te' ? 'వివరాలు చూపించు' : 'Show Details')}
              </button>
            </div>

            <div className="space-y-3">
              {topMarkets.map((item) => (
                <div key={item.market} className="rounded-lg border border-gray-100 p-3">
                  <p className="font-semibold text-gray-900">{item.market}{item.recommended ? ` - ${language === 'te' ? 'ఉత్తమ ఎంపిక' : 'Best Choice'}` : ''}</p>
                  <p className="text-sm text-gray-600">₹{item.modalPrice.toLocaleString()} / qtl | {item.distanceKm ? `${item.distanceKm} km` : (language === 'te' ? 'దూరం లేదు' : 'No distance data')}</p>
                  <p className="text-sm text-gray-700">
                    {item.trend7d >= 0 ? <span className="inline-flex items-center gap-1 text-green-700"><TrendingUp size={14} /> {item.trend7d}%</span> : <span className="inline-flex items-center gap-1 text-red-700"><TrendingDown size={14} /> {item.trend7d}%</span>}
                    <span className="ml-2">{language === 'te' ? 'అంచనా నికర లాభం' : 'Net profit'}: ₹{item.economics.netProfit.toLocaleString()}</span>
                  </p>
                  {detailed && (
                    <div className="mt-2 text-xs text-gray-600">
                      <p>{language === 'te' ? 'అంచనా 7రోజుల ధర' : 'Predicted 7-day price'}: ₹{item.predictedPrice7d.toLocaleString()}</p>
                      <p>{language === 'te' ? 'గ్రాస్ ఆదాయం' : 'Gross income'}: ₹{item.economics.grossIncome.toLocaleString()} | {language === 'te' ? 'మొత్తం ఖర్చు' : 'Total cost'}: ₹{item.economics.totalCost.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {detailed && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left">
                      <th className="p-2">{t('market')}</th>
                      <th className="p-2">{t('price')}</th>
                      <th className="p-2">{t('trend')}</th>
                      <th className="p-2">{language === 'te' ? 'అంచనా' : 'Prediction'}</th>
                      <th className="p-2">{language === 'te' ? 'నెట్ లాభం' : 'Net Profit'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketData.markets.map((item) => (
                      <tr key={item.market} className="border-b border-gray-100">
                        <td className="p-2">{item.market}</td>
                        <td className="p-2">₹{item.modalPrice.toLocaleString()}</td>
                        <td className="p-2">{item.trend7d}%</td>
                        <td className="p-2">₹{item.predictedPrice7d.toLocaleString()}</td>
                        <td className={`p-2 font-semibold ${item.economics.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          ₹{item.economics.netProfit.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-bold text-gray-900">{language === 'te' ? 'ఇటీవలి మార్కెట్ ప్రశ్నలు' : 'Recent Market Queries'}</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">{language === 'te' ? 'ఇప్పటికీ హిస్టరీ లేదు.' : 'No history yet.'}</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                {history.slice(0, 5).map((item) => (
                  <li key={item.id} className="rounded-md bg-gray-50 px-3 py-2">
                    {t(item.commodity)} - {item.bestMarket || '-'} - ₹{item.bestNetProfit?.toLocaleString() || 0} ({new Date(item.createdAt).toLocaleString()})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {!loading && !marketData && !error && (
        <p className="mt-6 text-sm text-gray-600">{language === 'te' ? 'మార్కెట్ డేటా అందుబాటులో లేదు.' : 'No market data available.'}</p>
      )}
    </div>
  );
}