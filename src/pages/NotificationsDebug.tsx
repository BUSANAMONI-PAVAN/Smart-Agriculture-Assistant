import { useEffect, useState } from 'react';
import { Bug, Clock3, RefreshCcw, Zap } from 'lucide-react';
import { api, type AlertsDebugResponse } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

export function NotificationsDebug() {
  const { language } = useLanguage();
  const [data, setData] = useState<AlertsDebugResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getAlertsDebug();
      setData(response);
    } catch {
      setError(language === 'te' ? 'డీబగ్ డేటా లోడ్ కాలేదు.' : 'Unable to load debug data.');
    } finally {
      setLoading(false);
    }
  };

  const runNow = async () => {
    setLoading(true);
    try {
      await api.triggerAlertScheduleTick();
      await load();
    } catch {
      setError(language === 'te' ? 'షెడ్యూలర్ రన్ కాలేదు.' : 'Scheduler run failed.');
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 60000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Bug className="text-indigo-600" />
          {language === 'te' ? 'నోటిఫికేషన్ డీబగ్ ప్యానెల్' : 'Notifications Debug Panel'}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void runNow()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Zap size={16} /> {language === 'te' ? 'షెడ్యూలర్ రన్ చేయి' : 'Run Scheduler Now'}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCcw size={16} /> {loading ? (language === 'te' ? 'లోడ్...' : 'Loading...') : language === 'te' ? 'రిఫ్రెష్' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">{language === 'te' ? 'షెడ్యూలర్ స్టేటస్' : 'Scheduler Status'}</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{data.scheduler.running ? 'Running' : 'Stopped'}</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">{language === 'te' ? 'చివరి రన్' : 'Last Run'}</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{data.scheduler.lastRunAt ? new Date(data.scheduler.lastRunAt).toLocaleString() : '-'}</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">{language === 'te' ? 'తదుపరి రన్' : 'Next Run'}</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{data.scheduler.nextRunAt ? new Date(data.scheduler.nextRunAt).toLocaleString() : '-'}</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">{language === 'te' ? 'డీడుప్ ఫింగర్‌ప్రింట్స్' : 'Dedupe Fingerprints'}</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{data.store.dedupeCount}</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-bold text-gray-900">{language === 'te' ? 'చివరి షెడ్యూలర్ సమరీ' : 'Last Scheduler Summary'}</h2>
            <div className="grid gap-3 text-sm md:grid-cols-5">
              <p className="rounded-lg bg-gray-50 p-3"><span className="font-semibold">Profiles:</span> {data.scheduler.lastSummary.profilesProcessed}</p>
              <p className="rounded-lg bg-gray-50 p-3"><span className="font-semibold">Alerts:</span> {data.scheduler.lastSummary.alertsCreated}</p>
              <p className="rounded-lg bg-gray-50 p-3"><span className="font-semibold">Lifecycle:</span> {data.scheduler.lastSummary.bySource.lifecycle}</p>
              <p className="rounded-lg bg-gray-50 p-3"><span className="font-semibold">Weather:</span> {data.scheduler.lastSummary.bySource.weather}</p>
              <p className="rounded-lg bg-gray-50 p-3"><span className="font-semibold">Disease:</span> {data.scheduler.lastSummary.bySource.disease}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
                <Clock3 size={18} className="text-amber-600" />
                {language === 'te' ? 'డీడుప్ విండోలు' : 'Dedupe Windows'}
              </h3>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-2">Type</th>
                      <th className="p-2">Source</th>
                      <th className="p-2">Next Eligible</th>
                      <th className="p-2">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.store.dedupeEntries.map((entry) => (
                      <tr key={entry.fingerprint} className="border-b align-top">
                        <td className="p-2 capitalize">{entry.type}</td>
                        <td className="p-2 text-gray-600">{entry.source}</td>
                        <td className="p-2 text-gray-600">{new Date(entry.nextEligibleAt).toLocaleString()}</td>
                        <td className="p-2 font-semibold text-gray-900">{entry.remainingMinutes}m</td>
                      </tr>
                    ))}
                    {data.store.dedupeEntries.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-3 text-gray-500">
                          {language === 'te' ? 'డీడుప్ ఎంట్రీలు లేవు.' : 'No dedupe entries yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-lg font-bold text-gray-900">{language === 'te' ? 'తాజా అలర్ట్స్' : 'Latest Alerts'}</h3>
              <div className="max-h-[420px] space-y-2 overflow-auto">
                {data.store.latestAlerts.map((item) => (
                  <article key={item.id} className="rounded-lg border bg-gray-50 p-3 text-sm">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900">{item.title}</p>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs capitalize text-gray-700">{item.level}</span>
                    </div>
                    <p className="text-gray-700">{item.message}</p>
                    <p className="mt-1 text-xs text-gray-500">{item.source} | {new Date(item.createdAt).toLocaleString()}</p>
                  </article>
                ))}
                {data.store.latestAlerts.length === 0 && (
                  <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
                    {language === 'te' ? 'ఇప్పటికీ అలర్ట్స్ లేవు.' : 'No alerts created yet.'}
                  </p>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
