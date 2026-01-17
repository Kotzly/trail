import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-stroke/40 bg-base/80">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-6 text-xs text-ink-subtle md:flex-row md:items-center">
        <span>{t("footer.copyright", { year })}</span>
        <span>{t("footer.tagline")}</span>
      </div>
    </footer>
  );
}
