import { fetchPage } from "../lib/sanity/queries";
import { SectionRenderer } from "./components/SectionRenderer";

export default async function HomePage() {
  const page = await fetchPage("home");

  if (!page?.sections?.length) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  return <SectionRenderer sections={page.sections} />;
}
