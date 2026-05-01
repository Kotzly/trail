import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LandingPage } from "@/app/components/landing/LandingPage";
import { fetchPage } from "@/lib/sanity/queries";
import { buildMetadata, defaultDescription, defaultTitle } from "@/lib/seo";

type PageParams = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const { locale } = await params;
  const page = await fetchPage("home", locale);
  const title = page?.seo?.title ?? defaultTitle;
  const description = page?.seo?.description ?? defaultDescription;

  return buildMetadata({
    title,
    description,
    path: "/",
    ogImage: page?.seo?.ogImage,
    absoluteTitle: true,
    locale,
  });
}

export default async function HomePage({ params }: { params: PageParams }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LandingPage />;
}
