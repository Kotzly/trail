"use client";

import { MessageSquare, ArrowUpRight } from "lucide-react";

export function LeaveNoteButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent("open-feedback", { detail: { type: "support" } }),
        );
      }}
      className="group flex cursor-pointer flex-col items-start rounded-2xl border border-border-subtle bg-surface p-6 text-left transition-colors hover:border-border-strong"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle bg-elevated text-text-secondary transition-colors group-hover:text-text-primary group-hover:border-border-strong">
        <MessageSquare size={18} />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-text-primary">
        Leave a Note
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-text-tertiary">
        Describe your issue and we&apos;ll follow up
      </p>
      <span className="mt-auto flex items-center gap-1 pt-4 text-xs font-medium text-text-secondary transition-colors group-hover:text-text-primary">
        Open form
        <ArrowUpRight
          size={12}
          className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </span>
    </button>
  );
}
