import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en/common.json";
import ru from "./locales/ru/common.json";

export const supportedLanguages = ["en", "ru"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];
export const languageStorageKey = "trail-lang";

const normalizeLanguage = (language?: string): SupportedLanguage => {
  if (!language) return "en";
  return language.startsWith("ru") ? "ru" : "en";
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en },
      ru: { common: ru },
    },
    fallbackLng: "en",
    supportedLngs: supportedLanguages,
    nonExplicitSupportedLngs: true,
    ns: ["common"],
    defaultNS: "common",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: languageStorageKey,
    },
  })
  .then(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = normalizeLanguage(i18n.language);
    }
  })
  .catch(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = "en";
    }
  });

i18n.on("languageChanged", (language) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = normalizeLanguage(language);
  }
});

export default i18n;
