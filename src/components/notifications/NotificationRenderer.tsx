import { CropReminder } from './CropReminder';
import { DiseaseDetectionAlert } from './DiseaseDetectionAlert';
import { MarketInsight } from './MarketInsight';
import { PestAlert } from './PestAlert';
import { SoilUpdate } from './SoilUpdate';
import type { NotificationCardItem, NotificationCardProps, NotificationVisualKind } from './types';
import { WeatherAlert } from './WeatherAlert';

const SOIL_PATTERN = /\b(soil|npk|nitrogen|phosphorus|potassium|fertility|ph|organic carbon|micronutrient)\b/i;
const WEATHER_PATTERN = /\b(rain|storm|irrigation|heat|temperature|forecast|wind|humidity|weather)\b/i;
const MARKET_PATTERN = /\b(market|mandi|price|buyer|procurement|demand|trend)\b/i;
const PEST_PATTERN = /\b(pest|aphid|borer|worm|hopper|weevil|beetle|insect|armyworm|thrips)\b/i;

function matches(pattern: RegExp, item: NotificationCardItem) {
  return pattern.test(`${item.title} ${item.message}`);
}

export function getNotificationVisualKind(item: NotificationCardItem): NotificationVisualKind {
  if (item.type === 'weather' || matches(WEATHER_PATTERN, item)) {
    return 'weather';
  }

  if (item.type === 'market' || matches(MARKET_PATTERN, item)) {
    return 'market';
  }

  if (matches(SOIL_PATTERN, item)) {
    return 'soil';
  }

  if (item.type === 'disease' && (item.level === 'high' || matches(PEST_PATTERN, item))) {
    return 'pest';
  }

  if (item.type === 'disease') {
    return 'disease';
  }

  return 'crop';
}

export function getNotificationTargetPath(item: NotificationCardItem) {
  const kind = getNotificationVisualKind(item);

  if (kind === 'weather') return '/weather';
  if (kind === 'market') return '/market-prices';
  if (kind === 'soil') return '/fertilizer-calc';
  if (kind === 'pest' || kind === 'disease') return '/disease-detect';
  return '/crop-recommend';
}

export function NotificationRenderer(props: NotificationCardProps) {
  const kind = getNotificationVisualKind(props.item);

  if (kind === 'weather') {
    return <WeatherAlert {...props} />;
  }

  if (kind === 'soil') {
    return <SoilUpdate {...props} />;
  }

  if (kind === 'market') {
    return <MarketInsight {...props} />;
  }

  if (kind === 'pest') {
    return <PestAlert {...props} />;
  }

  if (kind === 'disease') {
    return <DiseaseDetectionAlert {...props} />;
  }

  return <CropReminder {...props} />;
}
