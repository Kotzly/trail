import type { Timestamp, Url } from "../../../../shared/types/ids.js";

export function formatTime(timestamp: Timestamp): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    return new Date(timestamp).toLocaleDateString();
}

export function formatUrl(url: Url): string {
    try {
      const urlObj = new URL(url);
      let display = urlObj.hostname;
      if (urlObj.pathname !== '/') display += urlObj.pathname;
      if (urlObj.hash) display += urlObj.hash;
      return display;
    } catch {
      return url;
    }
}

export function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
