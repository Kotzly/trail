import type { Metadata } from "next";
import { fetchPage } from "../lib/sanity/queries";
import { SectionRenderer } from "./components/SectionRenderer";
import { defaultTitle, defaultDescription, resolveOgImage } from "../lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage("home");
  const image = resolveOgImage(page?.seo?.ogImage);
  const title = page?.seo?.title ?? defaultTitle;
  const description = page?.seo?.description ?? defaultDescription;

  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      images: [image.url],
    },
  };
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

  return <SectionRenderer sections={page.sections} />;
}
