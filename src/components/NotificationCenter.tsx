import { useMemo, useState } from 'react';
import { BellRing, RefreshCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';
import { getNotificationTargetPath, NotificationRenderer } from './notifications/NotificationRenderer';

export function NotificationCenter() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { notifications, unreadCount, loading, markAsRead, refreshNotifications } = useNotifications();
  const [open, setOpen] = useState(false);

  const latest = useMemo(() => notifications.slice(0, 12), [notifications]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-full border border-white/12 bg-white/12 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur transition hover:bg-white/18"
        aria-label={language === 'te' ? 'Alerts' : 'Alerts'}
      >
        <BellRing size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-[min(94vw,28rem)] overflow-hidden rounded-[28px] border border-[#d7e6d5] bg-[linear-gradient(180deg,#fcfffb,#f4faf7_38%,#eef7f2)] p-4 text-gray-800 shadow-[0_28px_64px_rgba(18,43,29,0.2)]">
          <div className="mb-4 rounded-[22px] bg-[linear-gradient(135deg,#24563a,#4f8767)] p-4 text-white shadow-[0_18px_36px_rgba(21,56,38,0.22)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">Field Signals Desk</p>
                <h3 className="mt-1 text-lg font-black">{language === 'te' ? 'AgriField Signals' : 'AgriField Signals'}</h3>
                <p className="mt-1 text-xs text-white/78">
                  {unreadCount > 0
                    ? `${unreadCount} active field alerts ready for review`
                    : 'All field alerts are under control'}
                </p>
              </div>
              <div className="rounded-2xl bg-white/12 px-3 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/68">Unread</p>
                <p className="text-xl font-black">{unreadCount}</p>
              </div>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-[#173828]">{language === 'te' ? 'Smart Alerts' : 'Smart Alerts'}</h3>
            <button
              type="button"
              onClick={() => void refreshNotifications()}
              className="inline-flex items-center gap-1 rounded-full border border-[#cfdfcf] bg-white px-3 py-1.5 text-xs font-semibold text-[#31533e] shadow-[0_10px_24px_rgba(35,74,50,0.08)] transition hover:bg-[#f8fbf7]"
            >
              <RefreshCcw size={12} />
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          <div className="max-h-[32rem] space-y-3 overflow-auto pr-1">
            {latest.map((item) => (
              <NotificationRenderer
                key={item.id}
                item={item}
                onOpen={() => {
                  setOpen(false);
                  navigate(getNotificationTargetPath(item));
                }}
                onDismiss={!item.read ? () => void markAsRead(item.id) : undefined}
                onRead={!item.read ? () => void markAsRead(item.id) : undefined}
              />
            ))}

            {!latest.length && (
              <p className="rounded-[20px] border border-dashed border-[#d6e1d5] bg-white/70 p-4 text-center text-xs text-gray-500">
                No active alerts right now.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
