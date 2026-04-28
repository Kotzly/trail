import { setRequestLocale } from "next-intl/server";
import { LegalShell } from "../LegalShell";
import { getLegalDoc } from "../legal-source";
import { buildMetadata } from "@/lib/seo";
import { SiteChrome } from "@/app/components/SiteChrome";

export const dynamic = "force-static";

type TermsPageParams = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: TermsPageParams;
}) {
  const { locale } = await params;
  return buildMetadata({
    title: "Terms of Service",
    description:
      "Review responsibilities, acceptable use, billing, and how the product is provided, including updates, suspension, and termination.",
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
  const doc = await getLegalDoc("Terms of Service");

  return (
    <SiteChrome locale={locale}>
      <LegalShell
        eyebrow="Legal"
        title={doc.title}
        lastUpdated={doc.lastUpdated ?? undefined}
        markdown={doc.markdown}
        related={{ label: "Privacy Policy →", href: "/privacy" }}
      />
    </SiteChrome>
  );
}
