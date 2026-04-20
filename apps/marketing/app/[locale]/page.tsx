import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { fetchPage } from "@/lib/sanity/queries";
import { SectionRenderer } from "@/app/components/SectionRenderer";
import { PageBackground } from "@/app/components/PageBackground";
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

  const page = await fetchPage("home", locale);

  if (!page?.sections?.length) {
    const t = await getTranslations("common");
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-text-secondary">{t("loading")}</p>
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
