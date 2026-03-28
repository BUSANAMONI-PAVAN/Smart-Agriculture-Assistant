import { useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { LineChart, IndianRupee } from 'lucide-react';
import { createAlert } from '../utils/alertEngine';

type CropUnit = {
  key: string;
  avgYieldQPerAcre: number;
  modalPrice: number;
};

const CROP_UNITS: CropUnit[] = [
  { key: 'rice', avgYieldQPerAcre: 24, modalPrice: 2450 },
  { key: 'cotton', avgYieldQPerAcre: 10, modalPrice: 6920 },
  { key: 'maize', avgYieldQPerAcre: 20, modalPrice: 2280 },
  { key: 'chilli', avgYieldQPerAcre: 9, modalPrice: 14150 },
  { key: 'banana', avgYieldQPerAcre: 125, modalPrice: 1890 },
  { key: 'marigold', avgYieldQPerAcre: 30, modalPrice: 4100 },
];

export function ProfitEstimator() {
  const { language, t } = useLanguage();
  const [crop, setCrop] = useState('rice');
  const [acres, setAcres] = useState('2');
  const [costPerAcre, setCostPerAcre] = useState('25000');
  const [markup, setMarkup] = useState('0');

  const selected = CROP_UNITS.find((item) => item.key === crop) || CROP_UNITS[0];
  const acreValue = Number(acres) || 0;
  const cost = Number(costPerAcre) || 0;
  const marketAdjustment = Number(markup) || 0;

  const summary = useMemo(() => {
    const adjustedPrice = Math.max(0, selected.modalPrice + marketAdjustment);
    const gross = selected.avgYieldQPerAcre * acreValue * adjustedPrice;
    const totalCost = acreValue * cost;
    const net = gross - totalCost;
    const roi = totalCost > 0 ? (net / totalCost) * 100 : 0;
    return { adjustedPrice, gross, totalCost, net, roi };
  }, [selected, acreValue, cost, marketAdjustment]);

  const recommendSale =
    summary.net > 0
      ? language === 'te'
        ? 'ప్రస్తుత ధర వద్ద విక్రయించవచ్చు. ధరల ట్రెండ్ పెరుగుతోంది.'
        : 'You can sell at current modal price. Trend is supportive.'
      : language === 'te'
      ? 'వెంటనే విక్రయించకుండా, నిల్వ/గ్రేడింగ్ లేదా మార్కెట్ టైమింగ్ పరిశీలించండి.'
      : 'Avoid distress sale now. Consider grading/storage and market timing.';

  return (
    <div className="container mx-auto max-w-4xl p-4">
      <h1 className="mb-6 flex items-center gap-2 text-3xl font-bold">
        <LineChart className="text-emerald-600" />
        {language === 'te' ? 'లాభ అంచనా వ్యవస్థ' : 'Profit Estimation System'}
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-emerald-100 bg-white p-5">
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">{t('select_crop')}</label>
            <select value={crop} onChange={(event) => setCrop(event.target.value)} className="w-full rounded-lg border px-3 py-2">
              {CROP_UNITS.map((item) => (
                <option key={item.key} value={item.key}>
                  {t(item.key)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">{t('land_size')}</label>
            <input value={acres} onChange={(event) => setAcres(event.target.value)} className="w-full rounded-lg border px-3 py-2" type="number" min="0" step="0.1" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">{language === 'te' ? 'ఎకరాకు మొత్తం ఖర్చు (₹)' : 'Total Cost Per Acre (₹)'}</label>
            <input value={costPerAcre} onChange={(event) => setCostPerAcre(event.target.value)} className="w-full rounded-lg border px-3 py-2" type="number" min="0" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">{language === 'te' ? 'మార్కెట్ ధర సర్దుబాటు (₹/క్వింటాల్)' : 'Market Price Adjustment (₹/Qtl)'}</label>
            <input value={markup} onChange={(event) => setMarkup(event.target.value)} className="w-full rounded-lg border px-3 py-2" type="number" />
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="mb-4 text-xl font-bold text-emerald-900">{language === 'te' ? 'ఆదాయం అంచనా' : 'Revenue Projection'}</h2>
          <div className="space-y-3 text-sm">
            <p className="flex items-center justify-between rounded-md bg-white p-2"><span>{language === 'te' ? 'అంచనా ధర' : 'Estimated Price'}</span><strong>₹{summary.adjustedPrice.toLocaleString()}</strong></p>
            <p className="flex items-center justify-between rounded-md bg-white p-2"><span>{language === 'te' ? 'స్థూల ఆదాయం' : 'Gross Income'}</span><strong>₹{summary.gross.toLocaleString()}</strong></p>
            <p className="flex items-center justify-between rounded-md bg-white p-2"><span>{language === 'te' ? 'మొత్తం ఖర్చు' : 'Total Cost'}</span><strong>₹{summary.totalCost.toLocaleString()}</strong></p>
            <p className="flex items-center justify-between rounded-md bg-white p-2"><span>{language === 'te' ? 'నికర లాభం' : 'Net Profit'}</span><strong className={summary.net >= 0 ? 'text-green-700' : 'text-red-700'}>₹{summary.net.toLocaleString()}</strong></p>
            <p className="flex items-center justify-between rounded-md bg-white p-2"><span>ROI</span><strong>{summary.roi.toFixed(1)}%</strong></p>
          </div>

          <button
            type="button"
            onClick={() =>
              createAlert({
                type: 'market',
                level: summary.net > 0 ? 'low' : 'medium',
                message: `${t(crop)}: ${recommendSale}`,
              })
            }
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
          >
            <IndianRupee size={16} />
            {language === 'te' ? 'లాభ అలర్ట్ సేవ్ చేయండి' : 'Save Profit Alert'}
          </button>

          <p className="mt-3 text-sm text-gray-700">{recommendSale}</p>
        </div>
      </div>
    </div>
  );
}