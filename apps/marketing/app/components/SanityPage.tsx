import { fetchPage } from "../../lib/sanity/queries";
import { SectionRenderer } from "./SectionRenderer";
import { MarketingPageShell } from "../shared/marketing-primitives";

interface SanityPageProps {
  slug: string;
  fallback: React.ReactNode;
}

export async function SanityPage({ slug, fallback }: SanityPageProps) {
  const page = await fetchPage(slug);

  if (!page?.sections?.length) {
    return <>{fallback}</>;
  }

  return (
    <MarketingPageShell>
      <SectionRenderer sections={page.sections} />
    </MarketingPageShell>
  );
}
