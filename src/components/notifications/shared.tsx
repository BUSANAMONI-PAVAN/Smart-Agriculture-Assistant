import type { KeyboardEvent, ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { formatNotificationTimestamp } from '../../utils/browserNotifications';

export const CARD_MOTION =
  'group transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-[0_20px_40px_rgba(15,26,20,0.18)]';

type CardShellProps = {
  children: ReactNode;
  className: string;
  onOpen?: () => void;
};

function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, onOpen?: () => void) {
  if (!onOpen) {
    return;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onOpen();
  }
}

export function NotificationCardShell({ children, className, onOpen }: CardShellProps) {
  return (
    <article
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(event) => handleCardKeyDown(event, onOpen)}
      className={`${CARD_MOTION} relative isolate overflow-hidden ${onOpen ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </article>
  );
}

type BadgeProps = {
  children: ReactNode;
  className: string;
};

export function NotificationBadge({ children, className }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${className}`}>
      {children}
    </span>
  );
}

type IconButtonProps = {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
};

export function NotificationIconButton({ label, onClick, children, className = '' }: IconButtonProps) {
  if (!onClick) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white/78 transition duration-200 hover:scale-105 hover:bg-white/18 ${className}`}
    >
      {children}
    </button>
  );
}

type ActionButtonProps = {
  label: string;
  onClick?: () => void;
  className: string;
  fullWidth?: boolean;
};

export function NotificationActionButton({ label, onClick, className, fullWidth = false }: ActionButtonProps) {
  if (!onClick) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`${fullWidth ? 'w-full' : ''} rounded-xl px-3 py-2 text-sm font-semibold transition duration-200 hover:scale-[1.01] active:scale-[0.99] ${className}`}
    >
      {label}
    </button>
  );
}

export function NotificationReadButton({
  onClick,
  read,
  className = '',
}: {
  onClick?: () => void;
  read: boolean;
  className?: string;
}) {
  if (!onClick && !read) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label={read ? 'Notification read' : 'Mark notification as read'}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition duration-200 hover:scale-105 ${className}`}
    >
      <Check size={15} />
    </button>
  );
}

type FooterProps = {
  createdAt: string;
  onRead?: () => void;
  read: boolean;
  light?: boolean;
};

export function NotificationFooter({ createdAt, onRead, read, light = false }: FooterProps) {
  return (
    <div className={`mt-3 flex items-center justify-between text-[11px] ${light ? 'text-slate-500' : 'text-white/58'}`}>
      <span>{formatNotificationTimestamp(createdAt)}</span>
      {!read && onRead && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRead();
          }}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition ${
            light ? 'bg-white text-slate-700 hover:bg-slate-50' : 'bg-white/12 text-white hover:bg-white/20'
          }`}
        >
          <Check size={12} />
          Read
        </button>
      )}
    </div>
  );
}

export function NotificationDismissButton({
  onClick,
  light = false,
  className = '',
}: {
  onClick?: () => void;
  light?: boolean;
  className?: string;
}) {
  return (
    <NotificationIconButton
      label="Dismiss notification"
      onClick={onClick}
      className={`${light ? 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50' : ''} ${className}`}
    >
      <X size={14} />
    </NotificationIconButton>
  );
}
