import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Calculator } from 'lucide-react';

export function FertilizerCalc() {
  const { t } = useLanguage();
  const [land, setLand] = useState('');
  const [crop, setCrop] = useState('');
  const [result, setResult] = useState<any | null>(null);

  const calculate = () => {
    if (!land || !crop) return;
    const acres = parseFloat(land);
    
    // Simple Logic
    setResult({
      urea: (acres * 50).toFixed(1) + " kg",
      dap: (acres * 25).toFixed(1) + " kg",
      mop: (acres * 15).toFixed(1) + " kg"
    });
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <Calculator className="text-orange-600" />
        {t('fertilizer_calc')}
      </h1>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-orange-50">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('land_size')}</label>
              <input 
                type="number"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                value={land}
                onChange={(e) => setLand(e.target.value)}
                placeholder="Ex: 5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('select_crop')}</label>
              <select 
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
              >
                <option value="">-- Select --</option>
                <option value="rice">{t('rice')}</option>
                <option value="cotton">{t('cotton')}</option>
                <option value="maize">{t('maize')}</option>
              </select>
            </div>

            <button 
              onClick={calculate}
              className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold hover:bg-orange-700 transition-colors shadow-lg"
            >
              {t('calculate')}
            </button>
          </div>
        </div>

        <div>
          {result && (
            <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
              <h3 className="text-xl font-bold text-orange-900 mb-4">{t('fertilizer_req')}</h3>
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-white rounded-lg shadow-sm">
                  <span className="font-medium text-gray-700">{t('urea')}</span>
                  <span className="font-bold text-orange-600">{result.urea}</span>
                </div>
                <div className="flex justify-between p-3 bg-white rounded-lg shadow-sm">
                  <span className="font-medium text-gray-700">{t('dap')}</span>
                  <span className="font-bold text-orange-600">{result.dap}</span>
                </div>
                <div className="flex justify-between p-3 bg-white rounded-lg shadow-sm">
                  <span className="font-medium text-gray-700">{t('mop')}</span>
                  <span className="font-bold text-orange-600">{result.mop}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}