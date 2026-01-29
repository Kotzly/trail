"use client";

import * as React from "react";
import { cn } from "@trail/ui";
import { useUiStore } from "@/src/store/useUiStore";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Footer } from "./Footer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const sidebarWidth = useUiStore((state) => state.sidebarWidth);
  const effectiveWidth = sidebarCollapsed
    ? 72
    : Math.min(Math.max(sidebarWidth, 200), 320);

  return (
    <div className="h-screen bg-bg text-ink">
      <div
        className={cn(
          "grid h-screen grid-cols-1 lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]"
        )}
        style={{ "--sidebar-width": `${effectiveWidth}px` } as React.CSSProperties}
      >
        <Sidebar />
        <div className="flex h-screen flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
