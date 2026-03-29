import { ScanSearch, ShieldAlert } from 'lucide-react';
import {
  NotificationActionButton,
  NotificationCardShell,
  NotificationDismissButton,
  NotificationFooter,
} from './shared';
import type { NotificationCardProps } from './types';

function getDiseaseMessage(title: string, message: string) {
  return message.trim() || title.trim() || 'Disease scan needs review from the latest field inspection.';
}

export function DiseaseDetectionAlert({ item, onOpen, onDismiss, onRead }: NotificationCardProps) {
  return (
    <NotificationCardShell
      onOpen={onOpen}
      className="rounded-[22px] border border-teal-200/45 bg-[linear-gradient(180deg,#183a37,#0f2624)] px-4 py-3.5 text-white shadow-[0_18px_36px_rgba(7,30,31,0.28)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%)]" />

      <div className="relative flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#244944,#122826)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <ScanSearch size={30} className="text-teal-100" strokeWidth={2.1} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] text-white/82">
              <ShieldAlert size={14} className="text-emerald-300" />
              <span className="font-medium">Crop Doctor</span>
            </div>
            <NotificationDismissButton onClick={onDismiss} className="text-white/72 hover:bg-white/16" />
          </div>

          <p className="mt-3 text-[15px] leading-6 text-white">
            <span className="font-black uppercase">DISEASE DETECTION:</span>{' '}
            <span className="font-semibold text-white/90">{getDiseaseMessage(item.title, item.message)}</span>
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <NotificationActionButton
              label="Review Scan"
              onClick={onOpen}
              className="bg-teal-300 text-slate-950 hover:bg-teal-200"
            />
          </div>

          <NotificationFooter createdAt={item.createdAt} onRead={onRead} read={item.read} />
        </div>
      </div>
    </NotificationCardShell>
  );
}
