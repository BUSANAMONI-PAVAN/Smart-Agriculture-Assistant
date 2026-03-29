export type BrowserNotificationType = 'weather' | 'disease' | 'crop' | 'lifecycle' | 'market' | 'system';
export type BrowserNotificationLevel = 'low' | 'medium' | 'high';
export type NotificationToolKey =
  | 'rainRadar'
  | 'cropDoctor'
  | 'fieldPlanner'
  | 'growthTracker'
  | 'mandiWatch'
  | 'farmDesk';

type NotificationInput = {
  type: BrowserNotificationType;
  level: BrowserNotificationLevel;
  title?: string;
  message: string;
  createdAt?: string;
  path?: string;
  tag?: string;
};

type NotificationPayload = {
  title: string;
  body: string;
  tool: NotificationToolKey;
  options: NotificationOptions;
};

export const APP_DISPLAY_NAME = 'AgriField Tools';
export const APP_SHORT_NAME = 'FieldKit';
export const NOTIFICATION_ICON = '/images/agri-tools-mark.svg';

const TOOL_DETAILS: Record<NotificationToolKey, { label: string; headline: string }> = {
  rainRadar: { label: 'Rain Radar', headline: 'Field weather watch' },
  cropDoctor: { label: 'Crop Doctor', headline: 'Plant care insight' },
  fieldPlanner: { label: 'Field Planner', headline: 'Crop action reminder' },
  growthTracker: { label: 'Growth Tracker', headline: 'Stage follow-up note' },
  mandiWatch: { label: 'Mandi Watch', headline: 'Market pulse update' },
  farmDesk: { label: 'Farm Desk', headline: 'Farm operations update' },
};

const TYPE_TO_TOOL: Record<BrowserNotificationType, NotificationToolKey> = {
  weather: 'rainRadar',
  disease: 'cropDoctor',
  crop: 'fieldPlanner',
  lifecycle: 'growthTracker',
  market: 'mandiWatch',
  system: 'farmDesk',
};

const LEVEL_LABELS: Record<BrowserNotificationLevel, string> = {
  low: 'Field note',
  medium: 'Amber watch',
  high: 'Red priority',
};

const KEYWORD_TO_TOOL: Array<{ pattern: RegExp; tool: NotificationToolKey }> = [
  { pattern: /\b(rain|storm|irrigation|heat|weather|forecast|temperature|wind)\b/i, tool: 'rainRadar' },
  { pattern: /\b(disease|pest|blight|mildew|fungus|infection|scouting)\b/i, tool: 'cropDoctor' },
  { pattern: /\b(nutrient|fertilizer|sowing|harvest|crop|soil|field|seed|recommendation)\b/i, tool: 'fieldPlanner' },
  { pattern: /\b(stage|growth|flowering|vegetative|lifecycle|follow-up)\b/i, tool: 'growthTracker' },
  { pattern: /\b(market|price|mandi|demand|buyer|procurement)\b/i, tool: 'mandiWatch' },
];

function compactText(value: string, fallback = '') {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function trimText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function resolveNotificationTool(input: Pick<NotificationInput, 'type' | 'title' | 'message'>) {
  const mergedText = `${compactText(input.title)} ${compactText(input.message)}`.trim();

  for (const entry of KEYWORD_TO_TOOL) {
    if (entry.pattern.test(mergedText)) {
      return entry.tool;
    }
  }

  return TYPE_TO_TOOL[input.type];
}

export function getNotificationToolLabel(tool: NotificationToolKey) {
  return TOOL_DETAILS[tool].label;
}

export function formatNotificationTimestamp(value: string) {
  try {
    return new Date(value).toLocaleString([], {
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export function formatBrowserNotification(input: NotificationInput): NotificationPayload {
  const tool = resolveNotificationTool(input);
  const toolMeta = TOOL_DETAILS[tool];
  const headline = compactText(input.title, toolMeta.headline);
  const body = trimText(`${LEVEL_LABELS[input.level]}. ${compactText(input.message)}`, 180);
  const title = trimText(`${toolMeta.label} | ${headline}`, 68);

  return {
    title,
    body,
    tool,
    options: {
      body,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: input.tag || `agri-${tool}-${input.type}`,
      renotify: input.level === 'high',
      requireInteraction: input.level === 'high',
      timestamp: input.createdAt ? new Date(input.createdAt).getTime() : Date.now(),
      data: {
        path: input.path || '/dashboard',
        tool,
      },
    },
  };
}

async function deliverNotification(input: NotificationInput) {
  const payload = formatBrowserNotification(input);

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.showNotification(payload.title, payload.options);
      return true;
    }
  }

  const notification = new Notification(payload.title, payload.options);
  notification.onclick = () => {
    window.focus();
    if (payload.options.data?.path) {
      window.location.assign(String(payload.options.data.path));
    }
    notification.close();
  };
  return true;
}

function normalizeNotificationInput(
  input: NotificationInput | string,
  maybeMessage?: string,
): NotificationInput {
  if (typeof input === 'string') {
    return {
      type: 'system',
      level: 'medium',
      title: input,
      message: compactText(maybeMessage || input),
      path: '/dashboard',
    };
  }

  return input;
}

export async function pushBrowserNotification(input: NotificationInput | string, maybeMessage?: string) {
  if (!('Notification' in window)) {
    return false;
  }

  const normalized = normalizeNotificationInput(input, maybeMessage);

  if (Notification.permission === 'granted') {
    return deliverNotification(normalized);
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    return deliverNotification(normalized);
  }

  return false;
}
