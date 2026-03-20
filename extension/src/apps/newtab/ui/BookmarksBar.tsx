import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../../ui/lib/utils.js";
import { ChevronRight, Folder, Globe } from "lucide-react";
import { getFaviconUrl } from "@shared/utils/favicon.js";
import type { Url } from "@shared/types/ids.js";
import type { BookmarkItem } from "./useBookmarks.js";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BookmarkFavicon({ url, size = 24 }: { url: string; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <Globe size={size} className="newtab-bookmark-icon" />;
  }

  return (
    <img
      src={getFaviconUrl(url as Url, size)}
      alt=""
      width={size}
      height={size}
      className="newtab-bookmark-favicon"
      onError={() => setFailed(true)}
    />
  );
}

function BookmarkLink({ item }: { item: BookmarkItem }) {
  return (
    <a href={item.url!} className="newtab-bookmark-card" title={item.title}>
      <BookmarkFavicon url={item.url!} />
      <span className="newtab-bookmark-label">{item.title}</span>
    </a>
  );
}

function DropdownItem({ item }: { item: BookmarkItem }) {
  if (item.children) {
    return <NestedFolder folder={item} />;
  }
  if (!item.url) return null;

  return (
    <a href={item.url} className="newtab-bookmark-dropdown-item" title={item.title}>
      <BookmarkFavicon url={item.url} size={16} />
      <span className="newtab-bookmark-dropdown-title">{item.title}</span>
    </a>
  );
}

function NestedFolder({ folder }: { folder: BookmarkItem }) {
  const children = folder.children ?? [];

  return (
    <>
      <div className="newtab-bookmark-dropdown-folder-label">
        <Folder size={12} />
        {folder.title}
      </div>
      {children.length === 0 ? (
        <div className="newtab-bookmark-dropdown-empty">Empty</div>
      ) : (
        children.map((child) => <DropdownItem key={child.id} item={child} />)
      )}
    </>
  );
}

function BookmarkFolder({ item }: { item: BookmarkItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  const children = item.children ?? [];

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      className="newtab-bookmark-card newtab-bookmark-card--folder"
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
      title={item.title}
    >
      <ChevronRight
        size={18}
        className={cn("newtab-bookmark-icon newtab-bookmark-chevron", open && "newtab-bookmark-chevron--open")}
      />
      <span className="newtab-bookmark-label">{item.title}</span>

      {open && (
        <div className="newtab-bookmark-dropdown">
          {children.length === 0 ? (
            <div className="newtab-bookmark-dropdown-empty">Empty folder</div>
          ) : (
            children.map((child) => <DropdownItem key={child.id} item={child} />)
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type BookmarksBarProps = {
  readonly bookmarks: readonly BookmarkItem[];
};

export function BookmarksBar({ bookmarks }: BookmarksBarProps) {
  if (bookmarks.length === 0) return null;

  return (
    <div className="newtab-bookmarks">
      <div className="newtab-bookmarks-grid">
        {bookmarks.map((item) =>
          item.url ? (
            <BookmarkLink key={item.id} item={item} />
          ) : (
            <BookmarkFolder key={item.id} item={item} />
          ),
        )}
      </div>
    </div>
  );
}
