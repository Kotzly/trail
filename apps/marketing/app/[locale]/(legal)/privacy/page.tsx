import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalShell } from "../LegalShell";
import { getLegalDoc } from "../legal-source";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-static";

type PrivacyPageParams = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: PrivacyPageParams;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return buildMetadata({
    title: t("privacyTitle"),
    description: t("privacyDescription"),
    path: "/privacy",
    locale,
  });
}

export default async function PrivacyPage({
  params,
}: {
  params: PrivacyPageParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [doc, t, tLegal] = await Promise.all([
    getLegalDoc("Privacy Policy"),
    getTranslations({ locale, namespace: "seo" }),
    getTranslations({ locale, namespace: "legal" }),
  ]);

  return (
    <div className="pt-20">
      <LegalShell
        eyebrow={tLegal("eyebrow")}
        title={t("privacyTitle")}
        lastUpdated={doc.lastUpdated ?? undefined}
        markdown={doc.markdown}
        related={{ label: tLegal("privacyToTerms"), href: "/terms" }}
      />
    </div>
  );
}
