import type { Icons } from '../components/Icon.js';

export type NotificationDurationMs = 1000 | 3000 | 5000 | 10000 | 15000;

export type NotificationId = string;

export type NotificationItem = {
  id: NotificationId;
  message: string;
  icon?: keyof typeof Icons;
  durationMs: NotificationDurationMs;
  createdAt: number;
  expiresAt: number;
  hasActions: boolean;
};

export type NotificationInput = {
  message: string;
  icon?: keyof typeof Icons;
  durationMs?: NotificationDurationMs;
  actions?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  onTimeout?: () => void;
};
