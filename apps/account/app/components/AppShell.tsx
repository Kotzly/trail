import * as React from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "@/components/ui/header-3";
import { Footer } from "./Footer";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Header />
          <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
