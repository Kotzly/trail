import type { Timestamp, Url } from "@shared/types/ids.js";

export function formatTime(timestamp: Timestamp): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  return new Date(timestamp).toLocaleDateString();
}

export function formatUrl(url: Url): string {
  try {
    const urlObj = new URL(url);
    let display = urlObj.hostname;
    if (urlObj.pathname !== "/") display += urlObj.pathname;
    if (urlObj.hash) display += urlObj.hash;
    return display;
  } catch {
    return url;
  }
}

export function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/** hostname with a leading `www.` stripped for readability. */
export function formatHost(url?: string | Url | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return String(url);
  }
}

/**
 * Compact, humane date:
 *   - today, yesterday
 *   - 'Apr 16' for the current year
 *   - 'Apr 16, 2025' for older dates
 */
export function formatDate(ts?: number | null): string {
  if (!ts) return "";
  try {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    if (sameDay) return "today";

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getFullYear() === yesterday.getFullYear() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getDate() === yesterday.getDate();
    if (isYesterday) return "yesterday";

    const thisYear = date.getFullYear() === now.getFullYear();
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      ...(thisYear ? {} : { year: "numeric" }),
    }).format(date);
  } catch {
    return "";
  }
}

const NUMBER_FORMATTER = new Intl.NumberFormat();

export function formatNodeCount(n: number): string {
  const rounded = Math.round(n);
  return `${NUMBER_FORMATTER.format(rounded)} ${rounded === 1 ? "node" : "nodes"}`;
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const diffMs = Date.now() - then;
    if (diffMs < 0) return "just now";
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
      new Date(iso),
    );
  } catch {
    return "";
  }
}

/**
 * Pick the most useful label for a tree-ish or node-ish entry. Falls back
 * past generic placeholders ("Unnamed Tree", "Untitled", empty strings)
 * and uses the root URL's host as a last-resort readable hint.
 */
export function displayLabel(entry: {
  label?: string | null;
  title?: string | null;
  rootTitle?: string | null;
  url?: string | null;
  rootUrl?: string | null;
}): string {
  const generic = (s: string) => s === "Unnamed Tree" || s === "Untitled" || s === "New Tab";

  const label = (entry.label ?? "").trim();
  if (label && !generic(label)) return label;

  const title = (entry.title ?? entry.rootTitle ?? "").trim();
  if (title && !generic(title)) return title;

  const host = formatHost(entry.url ?? entry.rootUrl);
  if (host) return host;

  return label || title || "Untitled";
}
