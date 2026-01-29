"use client";

import * as React from "react";
import { cn } from "@trail/ui";
import { useUiStore } from "@/src/store/useUiStore";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Footer } from "./Footer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);

  return (
    <div className="min-h-screen bg-bg">
      <div
        className={cn(
          "grid min-h-screen gap-6 px-4 py-6 lg:grid-cols-[256px_1fr] lg:gap-8 lg:px-6",
          sidebarCollapsed && "lg:grid-cols-[92px_1fr]"
        )}
      >
        <Sidebar />
        <div className="flex min-h-screen flex-col gap-6">
          <TopBar />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
