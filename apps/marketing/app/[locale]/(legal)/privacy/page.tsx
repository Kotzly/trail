import { setRequestLocale } from "next-intl/server";
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
  return buildMetadata({
    title: "Privacy Policy",
    description:
      "Learn what data is collected, how it is stored, and the choices you have to control sharing, retention, exports, and deletion requests.",
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
  const doc = await getLegalDoc("Privacy Policy");

  return (
    <div className="pt-20">
      <LegalShell
        eyebrow="Legal"
        title={doc.title}
        lastUpdated={doc.lastUpdated ?? undefined}
        markdown={doc.markdown}
        related={{ label: "Terms of Service →", href: "/terms" }}
      />
    </div>
  );
}
