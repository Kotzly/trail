import type { NotificationId, NotificationInput, NotificationItem } from './types.js';
import { useStore } from '../state/store.js';

type NotificationCallbacks = {
  onConfirm?: () => void;
  onCancel?: () => void;
  onTimeout?: () => void;
};

class NotificationCenter {
  private timers = new Map<NotificationId, number>();
  private callbacks = new Map<NotificationId, NotificationCallbacks>();

  notify(input: NotificationInput): NotificationId {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const durationMs = input.durationMs ?? 3000;
    const createdAt = Date.now();
    const expiresAt = createdAt + durationMs;
    const hasActions = input.actions ?? Boolean(input.onConfirm || input.onCancel);
    const item: NotificationItem = {
      id,
      message: input.message,
      durationMs,
      createdAt,
      expiresAt,
      hasActions,
      ...(input.icon ? { icon: input.icon } : {}),
    };

    const callbacks: NotificationCallbacks = {};
    if (input.onConfirm) callbacks.onConfirm = input.onConfirm;
    if (input.onCancel) callbacks.onCancel = input.onCancel;
    if (input.onTimeout) callbacks.onTimeout = input.onTimeout;
    this.callbacks.set(id, callbacks);

    useStore.getState().addNotification(item);

    const timer = window.setTimeout(() => {
      this.dismiss(id, 'timeout');
    }, durationMs);
    this.timers.set(id, timer);

    return id;
  }

  confirm(id: NotificationId): void {
    const cb = this.callbacks.get(id);
    this.dismiss(id, 'confirm');
    cb?.onConfirm?.();
  }

  cancel(id: NotificationId): void {
    const cb = this.callbacks.get(id);
    this.dismiss(id, 'cancel');
    cb?.onCancel?.();
  }

  dismiss(id: NotificationId, reason: 'timeout' | 'confirm' | 'cancel' = 'timeout'): void {
    const timer = this.timers.get(id);
    if (timer) {
      window.clearTimeout(timer);
      this.timers.delete(id);
    }
    const cb = this.callbacks.get(id);
    this.callbacks.delete(id);
    useStore.getState().removeNotification(id);
    if (reason === 'timeout') {
      cb?.onTimeout?.();
    }
  }

  clear(): void {
    for (const [id, timer] of this.timers.entries()) {
      window.clearTimeout(timer);
      this.timers.delete(id);
      this.callbacks.delete(id);
    }
    useStore.getState().clearNotifications();
  }
}

export const notificationCenter = new NotificationCenter();
