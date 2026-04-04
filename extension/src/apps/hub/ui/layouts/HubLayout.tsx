import type { ReactNode } from "react";
import HubSidebar from "./HubSidebar.js";

type HubLayoutProps = {
  children: ReactNode;
};

export default function HubLayout({ children }: HubLayoutProps) {
  return (
    <div className="hub-layout">
      <HubSidebar />
      <main className="hub-main">{children}</main>
    </div>
  );
}
