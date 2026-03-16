import { useEffect, useState } from 'react';
import { browser } from '@shared/platform/webext.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BookmarkItem = {
  readonly id: string;
  readonly title: string;
  readonly url: string | null;
  readonly children: readonly BookmarkItem[] | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type BrowserBookmarkNode = {
  id: string;
  title: string;
  url?: string;
  children?: BrowserBookmarkNode[];
};

type BrowserWithBookmarks = typeof browser & {
  bookmarks?: {
    getTree?: () => Promise<BrowserBookmarkNode[]>;
  };
};

function mapNode(node: BrowserBookmarkNode): BookmarkItem | null {
  const isFolder = !node.url && Array.isArray(node.children);
  const isLink = typeof node.url === 'string';
  if (!isFolder && !isLink) return null;

  return {
    id: node.id,
    title: node.title || (isLink ? hostnameOf(node.url!) : 'Folder'),
    url: isLink ? node.url! : null,
    children: isFolder
      ? (node.children ?? []).map(mapNode).filter(Boolean) as BookmarkItem[]
      : null,
  };
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 24);
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBookmarks(): { bookmarks: readonly BookmarkItem[]; loading: boolean } {
  const [bookmarks, setBookmarks] = useState<readonly BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const api = (browser as BrowserWithBookmarks).bookmarks;
    if (!api?.getTree) {
      setLoading(false);
      return;
    }

    api.getTree()
      .then((tree) => {
        const barFolder = tree[0]?.children?.[0];
        const items = (barFolder?.children ?? [])
          .map(mapNode)
          .filter(Boolean) as BookmarkItem[];
        setBookmarks(items);
      })
      .catch(() => {
        // Bookmarks API unavailable or permission denied — degrade silently
      })
      .finally(() => setLoading(false));
  }, []);

  return { bookmarks, loading };
}
