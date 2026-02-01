"use client";

import { ExtensionConnectionGuide } from "@/app/components/onboarding/ExtensionConnectionGuide";

export function ExtensionConnectionGuideClient() {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/70 p-4">
      <ExtensionConnectionGuide />
    </div>
  );
}
