import { ChartNoAxesCombined, TrendingUp } from 'lucide-react';
import { NotificationCardShell, NotificationDismissButton } from './shared';
import type { NotificationCardProps } from './types';

function getInsight(title: string, message: string) {
  const combined = [title.trim(), message.trim()].filter(Boolean).join(' ');
  return combined || 'Cotton price trend is upward. Hold crop.';
}

export function MarketInsight({ item, onOpen, onDismiss }: NotificationCardProps) {
  return (
    <NotificationCardShell
      onOpen={onOpen}
      className="rounded-[22px] border border-[#83573b] bg-[linear-gradient(180deg,#8c5a3a,#6f462d)] px-4 py-3.5 text-white shadow-[0_18px_36px_rgba(63,38,20,0.28)]"
    >
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.04)_0px,rgba(255,255,255,0.04)_1px,transparent_1px,transparent_7px),linear-gradient(90deg,rgba(255,255,255,0.05),transparent_38%,rgba(0,0,0,0.08))]" />

      <div className="relative flex items-start gap-4">
        <div className="flex h-[4.2rem] w-[4.7rem] shrink-0 items-center justify-center rounded-[16px] border border-white/12 bg-[linear-gradient(180deg,#563625,#3f2419)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <ChartNoAxesCombined size={34} className="text-[#9ae0cd]" strokeWidth={2.2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] text-white/82">
              <TrendingUp size={14} className="text-[#9ef0d2]" />
              <span className="font-medium">MarketMate</span>
            </div>
            <NotificationDismissButton onClick={onDismiss} className="text-white/72 hover:bg-white/16" />
          </div>

          <p className="mt-3 text-[15px] leading-6 text-white">
            <span className="font-black uppercase">MARKET INSIGHT:</span>{' '}
            <span className="font-semibold text-white/92">{getInsight(item.title, item.message)}</span>
          </p>
        </div>
      </div>
    </NotificationCardShell>
  );
}
