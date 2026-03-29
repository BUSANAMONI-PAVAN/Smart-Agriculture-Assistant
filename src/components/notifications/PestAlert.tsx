import { AlertTriangle, Bug } from 'lucide-react';
import { NotificationActionButton, NotificationCardShell, NotificationDismissButton } from './shared';
import type { NotificationCardProps } from './types';

function getUrgentBody(title: string, message: string) {
  const combined = [title.trim(), message.trim()].filter(Boolean).join(' ');
  return combined || 'Possible Aphid detection in Sector 3. Immediate inspection advised.';
}

export function PestAlert({ item, onOpen, onDismiss }: NotificationCardProps) {
  return (
    <NotificationCardShell
      onOpen={onOpen}
      className="rounded-[22px] border border-red-500/85 bg-[linear-gradient(180deg,#111111,#040404)] px-4 py-3.5 text-white shadow-[0_24px_42px_rgba(79,0,0,0.34)]"
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-red-500" />
      <div className="absolute inset-0 rounded-[22px] ring-1 ring-red-400/20" />

      <div className="relative flex items-start gap-3.5">
        <div className="relative flex h-[5.2rem] w-[5.2rem] shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-white/8 bg-[linear-gradient(180deg,#607f2e,#304717)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_28%,rgba(255,255,255,0.3),transparent_22%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.18))]" />
          <Bug size={34} className="relative text-[#d4f06f]" strokeWidth={2.1} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] text-white/82">
              <AlertTriangle size={13} className="text-red-500" fill="currentColor" />
              <span className="font-medium">PestAlert</span>
            </div>
            <NotificationDismissButton onClick={onDismiss} className="text-white/70 hover:bg-white/14" />
          </div>

          <p className="mt-2.5 text-[15px] leading-6 text-white">
            <span className="font-black text-white">URGENT:</span>{' '}
            <span className="font-semibold text-white/92">{getUrgentBody(item.title, item.message)}</span>
          </p>

          <div className="mt-4">
            <NotificationActionButton
              label="View Details"
              onClick={onOpen}
              className="bg-red-600 text-white shadow-[0_14px_24px_rgba(183,20,20,0.36)] hover:bg-red-500"
              fullWidth
            />
          </div>
        </div>
      </div>
    </NotificationCardShell>
  );
}
