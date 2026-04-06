import type { ReactNode } from "react";
import HubSidebar from "./HubSidebar.js";

type HubLayoutProps = {
  children: ReactNode;
};

export default function HubLayout({ children }: HubLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <HubSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto py-8 px-10">
        <div className="flex flex-col gap-5 max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
