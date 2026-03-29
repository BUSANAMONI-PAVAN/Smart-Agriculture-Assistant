export type NotificationCardItem = {
  id: string;
  type: 'weather' | 'disease' | 'crop' | 'lifecycle' | 'market' | 'system';
  level: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export type NotificationVisualKind =
  | 'weather'
  | 'crop'
  | 'soil'
  | 'market'
  | 'pest'
  | 'disease';

export type NotificationCardProps = {
  item: NotificationCardItem;
  onOpen?: () => void;
  onDismiss?: () => void;
  onRead?: () => void;
};
