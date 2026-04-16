import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import type { Url } from "@shared/types/ids.js";

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
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "";
  if (isToday(date)) return "today";
  if (isYesterday(date)) return "yesterday";
  const thisYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(thisYear ? {} : { year: "numeric" }),
  }).format(date);
}

const NUMBER_FORMATTER = new Intl.NumberFormat();

export function formatNodeCount(n: number): string {
  const rounded = Math.round(n);
  return `${NUMBER_FORMATTER.format(rounded)} ${rounded === 1 ? "node" : "nodes"}`;
}

export function formatRelativeTime(input: string | number | Date | null): string {
  if (input == null) return "";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  if (Date.now() - date.getTime() < 60_000) return "just now";
  return formatDistanceToNow(date, { addSuffix: true });
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
