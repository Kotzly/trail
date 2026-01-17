import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { LogOut, Moon, Sun } from "lucide-react";
import { applyTheme, getInitialTheme, themeStorageKey, type Theme } from "@/lib/theme";
import trailDark from "@/assets/trail.svg";
import trailLight from "@/assets/trail-light.svg";

const navLinkBase = "text-sm font-medium transition text-ink-subtle hover:text-ink";
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `${navLinkBase} ${isActive ? "text-ink" : ""}`;

export default function Navbar() {
  const { status, user, logout } = useAuth();
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      const stored = localStorage.getItem(themeStorageKey);
      if (stored !== "light" && stored !== "dark") {
        setTheme(event.matches ? "dark" : "light");
      }
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const logoSrc = theme === "dark" ? trailLight : trailDark;

  return (
    <header className="sticky top-0 z-40 border-b border-stroke/40 bg-base/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3 text-lg font-display font-semibold tracking-tight text-ink">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-stroke/40 bg-surface shadow-card">
            <img src={logoSrc} alt="trail" className="h-7 w-7" />
          </span>
          trail
        </Link>
        <nav className="flex items-center gap-5">
          <a href="/#features" className={navLinkBase}>
            Features
          </a>
          <a href="/#workflow" className={navLinkBase}>
            Workflow
          </a>
          <NavLink to="/pricing" className={navLinkClass}>
            Pricing
          </NavLink>
          <a href="/#faq" className={navLinkBase}>
            FAQ
          </a>
          {status === "authenticated" && (
            <NavLink to="/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
          )}
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-full border border-stroke/50 bg-surface/70 p-2 text-ink transition hover:border-stroke/80"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {status === "authenticated" ? (
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-2 rounded-full border border-stroke/60 px-4 py-2 text-sm font-medium text-ink transition hover:border-stroke"
            >
              <LogOut className="h-4 w-4" />
              {user?.email ?? "Logout"}
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-surface shadow-card transition hover:bg-ink-muted"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
