import { FlaskConical } from 'lucide-react';
import { NotificationActionButton, NotificationCardShell, NotificationDismissButton } from './shared';
import type { NotificationCardProps } from './types';

const SOIL_TOKENS = [
  { label: 'N', className: 'bg-[#6f4b2f] text-white' },
  { label: 'P', className: 'bg-[#88a35f] text-white' },
  { label: 'K', className: 'bg-[#9a7650] text-white' },
];

function getSoilMessage(title: string, message: string) {
  const primary = message.trim() || title.trim();
  return primary || 'Nitrogen levels optimal. Check Phosphorus levels next.';
}

export function SoilUpdate({ item, onOpen, onDismiss }: NotificationCardProps) {
  return (
    <NotificationCardShell
      onOpen={onOpen}
      className="rounded-[22px] border border-[#8aa17b] bg-[linear-gradient(180deg,#728762,#5d7350)] px-4 py-3.5 text-white shadow-[0_20px_38px_rgba(44,62,37,0.3)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_32%),repeating-linear-gradient(135deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_2px,transparent_2px,transparent_7px)] opacity-80" />

      <div className="relative flex items-start gap-4">
        <div className="grid shrink-0 grid-cols-2 gap-1.5 pt-2">
          {SOIL_TOKENS.map((token) => (
            <div
              key={token.label}
              className={`flex h-11 w-11 items-center justify-center text-lg font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] [clip-path:polygon(25%_6%,75%_6%,100%_50%,75%_94%,25%_94%,0_50%)] ${token.className}`}
            >
              {token.label}
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] text-white/86">
              <FlaskConical size={14} className="text-white/90" />
              <span className="font-medium">SoilProbe Max</span>
            </div>
            <NotificationDismissButton onClick={onDismiss} className="text-white/70 hover:bg-white/16" />
          </div>

          <p className="mt-3 text-[15px] leading-6 text-white">
            <span className="font-black uppercase">SOIL UPDATE:</span>{' '}
            <span className="font-semibold">{getSoilMessage(item.title, item.message)}</span>
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <NotificationActionButton
              label="View Soil Report"
              onClick={onOpen}
              className="min-w-[11rem] bg-[#d9e8c6] text-[#2e4026] shadow-[0_12px_20px_rgba(36,52,30,0.18)] hover:bg-[#e5f0d8]"
            />
            <NotificationActionButton
              label="Dismiss"
              onClick={onDismiss}
              className="min-w-[9rem] border border-white/30 bg-white/8 text-white hover:bg-white/16"
            />
          </div>
        </div>
      </div>
    </NotificationCardShell>
  );
}
