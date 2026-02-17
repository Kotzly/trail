import { fetchPage } from "../lib/sanity/queries";
import { SectionRenderer } from "./components/SectionRenderer";
import { MarketingPageShell } from "./shared/marketing-primitives";
import { HomeFallback } from "./HomeFallback";

export async function HomeContent() {
  const page = await fetchPage("home");

  if (!page?.sections?.length) {
    return <HomeFallback />;
  }

  return (
    <MarketingPageShell>
      <div className="relative">
        <SectionRenderer sections={page.sections} />
      </div>
    </MarketingPageShell>
  );
}
