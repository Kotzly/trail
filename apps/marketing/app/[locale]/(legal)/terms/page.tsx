import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalShell } from "../LegalShell";
import { getLegalDoc } from "../legal-source";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-static";

type TermsPageParams = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: TermsPageParams;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return buildMetadata({
    title: t("termsTitle"),
    description: t("termsDescription"),
    path: "/terms",
    locale,
  });
}

export default async function TermsPage({
  params,
}: {
  params: TermsPageParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [doc, t, tLegal] = await Promise.all([
    getLegalDoc("Terms of Service"),
    getTranslations({ locale, namespace: "seo" }),
    getTranslations({ locale, namespace: "legal" }),
  ]);

  return (
    <div className="pt-20">
      <LegalShell
        eyebrow={tLegal("eyebrow")}
        title={t("termsTitle")}
        lastUpdated={doc.lastUpdated ?? undefined}
        markdown={doc.markdown}
        related={{ label: tLegal("termsToPrivacy"), href: "/privacy" }}
      />
    </div>
  );
}
