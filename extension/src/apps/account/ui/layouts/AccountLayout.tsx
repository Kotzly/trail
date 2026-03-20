import type { ReactNode } from "react";
import AccountSidebar from "./AccountSidebar.js";

type AccountLayoutProps = {
  children: ReactNode;
};

export default function AccountLayout({ children }: AccountLayoutProps) {
  return (
    <div className="account-layout">
      <AccountSidebar />
      <main className="account-main">{children}</main>
    </div>
  );
}
