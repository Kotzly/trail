import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store.js';
import { notificationCenter } from '../notifications/notification-center.js';
import type { NotificationId, NotificationItem } from '../notifications/types.js';
import { Icons } from './Icon.js';
import React from 'react';

const DEFAULT_OFFSET = 12;
const EXIT_ANIMATION_MS = 220;

type RenderNotification = NotificationItem & { state: 'enter' | 'exit' | 'idle' };

function useAnchorStackTop(offset: number): number {
  const [top, setTop] = useState(offset);

  const updateTop = useCallback(() => {
    if (typeof document === 'undefined') return;
    const anchors = Array.from(
      document.querySelectorAll<HTMLElement>('[data-notify-anchor="true"]'),
    );
    let maxBottom = offset;
    for (const anchor of anchors) {
      const rect = anchor.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      maxBottom = Math.max(maxBottom, rect.bottom + offset);
    }
    setTop(Math.ceil(maxBottom));
  }, [offset]);

  useLayoutEffect(() => {
    updateTop();
  }, [updateTop]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const resizeObserver = new ResizeObserver(updateTop);
    const observeAnchors = () => {
      resizeObserver.disconnect();
      document
        .querySelectorAll<HTMLElement>('[data-notify-anchor="true"]')
        .forEach((el) => resizeObserver.observe(el));
      updateTop();
    };
    observeAnchors();
    const mutationObserver = new MutationObserver(() => observeAnchors());
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', updateTop);
    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateTop);
    };
  }, [updateTop]);

  return top;
}

export default function NotificationsHost() {
  const notifications = useStore((state) => state.notifications);
  const top = useAnchorStackTop(DEFAULT_OFFSET);
  const exitTimersRef = useRef<Map<NotificationId, number>>(new Map());
  const [renderItems, setRenderItems] = useState<RenderNotification[]>(() =>
    notifications.map((item) => ({ ...item, state: 'enter' })),
  );

  useEffect(() => {
    setRenderItems((prev) => {
      const nextMap = new Map<NotificationId, NotificationItem>(
        notifications.map((item) => [item.id, item]),
      );
      const seen = new Set<NotificationId>();
      const existing: RenderNotification[] = [];

      for (const prevItem of prev) {
        const nextItem = nextMap.get(prevItem.id);
        if (nextItem) {
          seen.add(prevItem.id);
          const nextState = prevItem.state === 'exit' ? 'enter' : prevItem.state;
          existing.push({ ...nextItem, state: nextState });
        } else {
          existing.push({ ...prevItem, state: 'exit' });
        }
      }

      const newcomers = notifications
        .filter((item) => !seen.has(item.id))
        .map((item) => ({ ...item, state: 'enter' as const }));

      return [...newcomers, ...existing];
    });
  }, [notifications]);

  useEffect(() => {
    const timers = exitTimersRef.current;
    for (const item of renderItems) {
      if (item.state === 'exit' && !timers.has(item.id)) {
        const timer = window.setTimeout(() => {
          timers.delete(item.id);
          setRenderItems((current) => current.filter((entry) => entry.id !== item.id));
        }, EXIT_ANIMATION_MS);
        timers.set(item.id, timer);
      }
    }
    for (const [id, timer] of timers.entries()) {
      const stillExit = renderItems.some((item) => item.id === id && item.state === 'exit');
      if (!stillExit) {
        window.clearTimeout(timer);
        timers.delete(id);
      }
    }
  }, [renderItems]);

  useEffect(() => () => {
    const timers = exitTimersRef.current;
    for (const timer of timers.values()) {
      window.clearTimeout(timer);
    }
    timers.clear();
  }, []);

  const items = useMemo(() => renderItems, [renderItems]);

  if (items.length === 0) return null;

  return (
    <div
      className="notifications-host"
      style={{ top, ['--notify-top' as string]: `${top}px` }}
    >
      <div className="notifications-stack">
        {items.map((item, index) => {
          const Icon = item.icon ? Icons[item.icon] : Icons.Bell;
          const stackIndex = Math.min(index, 3);
          return (
            <div
              key={item.id}
              className="notification-card"
              data-state={item.state}
              style={{
                ['--notify-duration' as string]: `${item.durationMs}ms`,
                ['--notify-index' as string]: String(stackIndex),
              }}
            >
              <div className="notification-content">
                <span className="notification-icon">
                  <Icon size={18} />
                </span>
                <span className="notification-message">{item.message}</span>
              </div>
              {item.hasActions ? (
                <div className="notification-actions">
                  <button
                    type="button"
                    className="notification-action-btn"
                    title="Confirm"
                    onClick={() => notificationCenter.confirm(item.id)}
                  >
                    <Icons.Check size={14} />
                  </button>
                  <button
                    type="button"
                    className="notification-action-btn"
                    title="Dismiss"
                    onClick={() => notificationCenter.cancel(item.id)}
                  >
                    <Icons.X size={14} />
                  </button>
                </div>
              ) : null}
              <div className="notification-progress" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
