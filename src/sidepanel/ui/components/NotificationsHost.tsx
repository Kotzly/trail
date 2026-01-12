import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store.js';
import { notificationCenter } from '../notifications/notification-center.js';
import { Icons } from './Icon.js';
import React from 'react';

const DEFAULT_OFFSET = 12;

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

  const items = useMemo(() => notifications, [notifications]);

  if (items.length === 0) return null;

  return (
    <div
      className="notifications-host"
      style={{ top, ['--notify-top' as string]: `${top}px` }}
    >
      <div className="notifications-stack">
        {items.map((item) => {
          const Icon = item.icon ? Icons[item.icon] : Icons.Bell;
          return (
            <div
              key={item.id}
              className="notification-card"
              style={{ ['--notify-duration' as string]: `${item.durationMs}ms` }}
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
