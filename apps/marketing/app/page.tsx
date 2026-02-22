import type { Metadata } from "next";
import { fetchPage } from "../lib/sanity/queries";
import { SectionRenderer } from "./components/SectionRenderer";
import { PageBackground } from "./components/PageBackground";
import { buildMetadata, defaultDescription, defaultTitle } from "../lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage("home");
  const title = page?.seo?.title ?? defaultTitle;
  const description = page?.seo?.description ?? defaultDescription;

  return buildMetadata({
    title,
    description,
    path: "/",
    ogImage: page?.seo?.ogImage,
    absoluteTitle: true,
  });
}

export default async function HomePage() {
  const page = await fetchPage("home");

  if (!page?.sections?.length) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <PageBackground />
      <SectionRenderer sections={page.sections} />
    </>
  );
}
