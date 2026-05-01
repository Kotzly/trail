"use client";

import { ArrowUpRight } from "lucide-react";

export function LeaveNoteButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent("open-feedback", { detail: { type: "support" } }),
        );
      }}
      className="group relative flex cursor-pointer flex-col bg-[var(--landing-bg)] text-left transition-colors duration-300 hover:bg-[rgba(20,17,12,0.85)]"
      style={{ padding: "clamp(28px, 3.2vw, 44px)", minHeight: 220 }}
    >
      <div
        className="font-mono uppercase"
        style={{
          fontSize: 11,
          letterSpacing: "0.22em",
          color: "rgba(246,239,225,0.4)",
          marginBottom: 16,
        }}
      >
        02 — Leave a note
      </div>
      <h3
        className="font-serif text-[var(--landing-ink)]"
        style={{
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          lineHeight: 1.15,
          marginBottom: 12,
        }}
      >
        Tell us what broke. We&rsquo;ll follow up.
      </h3>
      <span
        className="mt-auto inline-flex items-center gap-1.5 font-mono"
        style={{
          fontSize: 12,
          color: "var(--landing-ember)",
          letterSpacing: "0.04em",
        }}
      >
        Open the form
        <ArrowUpRight
          size={12}
          className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden
        />
      </span>
    </button>
  );
}
