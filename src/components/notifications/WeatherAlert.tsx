import { Check, Cloud, SunMedium, Zap } from 'lucide-react';
import { NotificationCardShell, NotificationDismissButton } from './shared';
import type { NotificationCardProps } from './types';

const TELUGU_SUBTITLE = 'తెలుగు: అధిక ఉష్ణోగ్రతలు వస్తున్నాయి. నీటి షెడ్యూల్‌ను సమీక్షించండి.';

function getWeatherSummary(message: string, title: string) {
  return message.trim() || title.trim() || 'High temperature coming. Review irrigation schedule.';
}

export function WeatherAlert({ item, onOpen, onDismiss, onRead }: NotificationCardProps) {
  const summary = getWeatherSummary(item.message, item.title);

  return (
    <NotificationCardShell
      onOpen={onOpen}
      className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f4f6fa)] px-4 py-3 text-slate-900 shadow-[0_18px_34px_rgba(102,120,146,0.16)]"
    >
      <div className="flex items-start gap-3">
        <div className="relative mt-1 flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center rounded-[20px] bg-[linear-gradient(180deg,#eef4ff,#dfe8f3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
          <SunMedium size={24} className="absolute left-2 top-2 text-[#f4b527]" strokeWidth={2.1} />
          <Cloud size={28} className="absolute left-5 top-5 text-[#91a5bf]" strokeWidth={2.1} />
          <Zap size={18} className="absolute bottom-2 right-2 text-[#f7b500]" strokeWidth={2.3} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-700">WeatherWise</p>
              <p className="mt-2 text-[14px] leading-6 text-slate-900">
                <span className="font-black uppercase tracking-[0.02em]">WATER ALERT:</span>{' '}
                <span className="font-semibold">{summary}</span>
              </p>
              <p className="mt-1.5 text-[14px] leading-6 text-slate-700">{TELUGU_SUBTITLE}</p>
            </div>

            <div className="flex items-center gap-2">
              {!item.read && onRead ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRead();
                  }}
                  aria-label="Mark notification as read"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition duration-200 hover:scale-105 hover:bg-slate-50"
                >
                  <Check size={14} />
                </button>
              ) : null}
              <NotificationDismissButton onClick={onDismiss} light className="border-slate-200 bg-white text-slate-500" />
            </div>
          </div>
        </div>
      </div>
    </NotificationCardShell>
  );
}
