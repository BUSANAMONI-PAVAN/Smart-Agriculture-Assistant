import { Leaf, Sprout } from 'lucide-react';
import { NotificationCardShell, NotificationReadButton } from './shared';
import type { NotificationCardProps } from './types';

function getHeadline(title: string, message: string) {
  const dayMatch = message.match(/\bDay\s+(\d+)\b/i);
  if (dayMatch && !title.match(/\bDay\s+\d+\b/i)) {
    return `${title.trim()}: Day ${dayMatch[1]}`;
  }

  return title.trim() || 'COTTON Nutrient Reminder: Day 14';
}

function getBody(message: string) {
  const cleaned = message.replace(/\bDay\s+\d+\s*:\s*/i, '').trim();
  return cleaned || 'Apply top-dressing based on soil test.';
}

export function CropReminder({ item, onOpen, onRead, onDismiss }: NotificationCardProps) {
  const readAction = onRead ?? onDismiss;

  return (
    <NotificationCardShell
      onOpen={onOpen}
      className="rounded-[22px] border border-[#4b4b4b] bg-[linear-gradient(180deg,#2f2f2f,#1f1f1f)] px-4 py-3.5 text-white shadow-[0_18px_36px_rgba(0,0,0,0.32)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_38%)]" />

      <div className="relative flex items-start gap-4">
        <div className="flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-[20px] bg-[linear-gradient(180deg,#2d4324,#191919)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Sprout size={34} className="text-[#9bd055]" strokeWidth={2.2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] text-white/82">
              <Leaf size={14} className="text-[#8cc657]" />
              <span className="font-medium">CropTrak</span>
            </div>

            <NotificationReadButton
              onClick={readAction}
              read={item.read}
              className={
                item.read
                  ? 'border-emerald-300/40 bg-emerald-400/18 text-emerald-100'
                  : 'border-emerald-200/20 bg-emerald-300/10 text-emerald-200 hover:bg-emerald-300/18'
              }
            />
          </div>

          <div className="mt-3 rounded-[18px] bg-white/[0.05] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <p className="text-[15px] font-black leading-6 text-white">{getHeadline(item.title, item.message)}</p>
            <p className="mt-1.5 text-[14px] leading-6 text-white/84">{getBody(item.message)}</p>
          </div>
        </div>
      </div>
    </NotificationCardShell>
  );
}
