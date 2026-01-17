import { useEffect, useMemo, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { applyTheme, getInitialTheme, themeStorageKey, type Theme } from "@/lib/theme";
import { languageStorageKey, supportedLanguages, type SupportedLanguage } from "@/i18n";
import trailDark from "@/assets/trail.svg";
import trailLight from "@/assets/trail-light.svg";

const navLinkBase = "text-sm font-medium transition text-ink-subtle hover:text-ink";
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `${navLinkBase} ${isActive ? "text-ink" : ""}`;

export default function Navbar() {
  const { status, user, logout } = useAuth();
  const { t, i18n } = useTranslation();
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
  const activeLanguage = useMemo<SupportedLanguage>(() => {
    const current = i18n.resolvedLanguage ?? i18n.language;
    return current.startsWith("ru") ? "ru" : "en";
  }, [i18n.language, i18n.resolvedLanguage]);

  const handleLanguageChange = (language: SupportedLanguage) => {
    i18n.changeLanguage(language);
    localStorage.setItem(languageStorageKey, language);
  };

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
            {t("nav.features")}
          </a>
          <a href="/#workflow" className={navLinkBase}>
            {t("nav.workflow")}
          </a>
          <NavLink to="/pricing" className={navLinkClass}>
            {t("nav.pricing")}
          </NavLink>
          <a href="/#faq" className={navLinkBase}>
            {t("nav.faq")}
          </a>
          {status === "authenticated" && (
            <NavLink to="/dashboard" className={navLinkClass}>
              {t("nav.dashboard")}
            </NavLink>
          )}
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-full border border-stroke/50 bg-surface/70 p-2 text-ink transition hover:border-stroke/80"
            aria-label={t("nav.themeToggle")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div
            className="flex items-center gap-1 rounded-full border border-stroke/50 bg-surface/70 p-1 text-xs font-semibold uppercase text-ink"
            aria-label={t("nav.languageLabel")}
          >
            {supportedLanguages.map((language) => {
              const isActive = language === activeLanguage;
              return (
                <button
                  key={language}
                  type="button"
                  onClick={() => handleLanguageChange(language)}
                  className={`rounded-full px-2 py-1 transition ${
                    isActive ? "bg-ink text-surface" : "text-ink-subtle hover:text-ink"
                  }`}
                  aria-label={t("nav.languageSwitch", { language: t(`languages.${language}`) })}
                >
                  {language.toUpperCase()}
                </button>
              );
            })}
          </div>
          {status === "authenticated" ? (
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-2 rounded-full border border-stroke/60 px-4 py-2 text-sm font-medium text-ink transition hover:border-stroke"
            >
              <LogOut className="h-4 w-4" />
              {user?.email ?? t("nav.logout")}
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-surface shadow-card transition hover:bg-ink-muted"
            >
              {t("nav.signIn")}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
