import { Link, NavLink } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { LogOut } from "lucide-react";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition ${isActive ? "text-ink" : "text-slate-500 hover:text-ink"}`;

export default function Navbar() {
  const { status, user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-sand/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-lg font-display font-semibold tracking-tight text-ink">
          Trail Cloud
        </Link>
        <nav className="flex items-center gap-6">
          <NavLink to="/pricing" className={navLinkClass}>
            Pricing
          </NavLink>
          {status === "authenticated" && (
            <NavLink to="/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
          )}
          {status === "authenticated" ? (
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition hover:border-ink/40"
            >
              <LogOut className="h-4 w-4" />
              {user?.email ?? "Logout"}
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-sand shadow-card transition hover:bg-slate"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
