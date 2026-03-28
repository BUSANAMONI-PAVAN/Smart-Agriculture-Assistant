import { useMemo, useState } from 'react';
import { BellRing, Check, RefreshCcw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';

function levelStyles(level: 'low' | 'medium' | 'high') {
  if (level === 'high') return 'bg-red-50 border-red-200 text-red-800';
  if (level === 'medium') return 'bg-amber-50 border-amber-200 text-amber-800';
  return 'bg-emerald-50 border-emerald-200 text-emerald-800';
}

export function NotificationCenter() {
  const { language } = useLanguage();
  const { notifications, unreadCount, loading, markAsRead, refreshNotifications } = useNotifications();
  const [open, setOpen] = useState(false);

  const latest = useMemo(() => notifications.slice(0, 12), [notifications]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-full bg-white/20 p-2 hover:bg-white/30"
        aria-label={language === 'te' ? 'అలర్ట్స్' : 'Alerts'}
      >
        <BellRing size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,22rem)] rounded-xl border border-gray-200 bg-white p-3 text-gray-800 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">{language === 'te' ? 'తెలివైన అలర్ట్స్' : 'Smart Alerts'}</h3>
            <button
              type="button"
              onClick={() => void refreshNotifications()}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <RefreshCcw size={12} />
              {loading ? (language === 'te' ? 'లోడ్...' : 'Loading...') : language === 'te' ? 'రిఫ్రెష్' : 'Refresh'}
            </button>
          </div>

          <div className="max-h-96 space-y-2 overflow-auto">
            {latest.map((item) => (
              <article key={item.id} className={`rounded-lg border p-2 text-xs ${levelStyles(item.level)}`}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="font-semibold">{item.title}</p>
                  {!item.read && (
                    <button
                      type="button"
                      onClick={() => void markAsRead(item.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-white/70 px-1.5 py-0.5 text-[11px] font-semibold hover:bg-white"
                    >
                      <Check size={10} /> {language === 'te' ? 'చదివాను' : 'Read'}
                    </button>
                  )}
                </div>
                <p>{item.message}</p>
                <p className="mt-1 text-[11px] opacity-70">{new Date(item.createdAt).toLocaleString()}</p>
              </article>
            ))}
            {!latest.length && (
              <p className="rounded-lg bg-gray-50 p-3 text-center text-xs text-gray-500">
                {language === 'te' ? 'ప్రస్తుతం అలర్ట్స్ లేవు.' : 'No active alerts right now.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
