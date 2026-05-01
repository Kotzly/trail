import { client } from "./client";

const imageFields = `
  asset->{_id, url, metadata{dimensions}},
  hotspot, crop
`;

const fileFields = `
  asset->{_id, url}
`;

// When the Sanity Studio installs @sanity/document-internationalization,
// documents will carry a `language` field and translated siblings will be
// stored as separate documents. Until then `coalesce(language, "en")`
// treats legacy single-locale documents as English and the default locale
// fallback inside each fetcher returns the English doc when no translation
// exists for the requested locale.

export const pageQuery = /* groq */ `
  *[_type == "landingPage"
    && slug.current == $slug
    && coalesce(language, "en") == $locale
  ][0]{
    _id,
    title,
    "slug": slug.current,
    seo{title, description, ogImage{${imageFields}}},
    sections[]{
      _type,
      _key,
      ...,
      video{${fileFields}},
      poster{${imageFields}},
      "features": features[]{...},
      "ctas": ctas[]{...},
    }
  }
`;

export const siteSettingsQuery = /* groq */ `
  *[_type == "siteSettings" && coalesce(language, "en") == $locale][0]{
    siteName,
    siteUrl,
    nav[]{label, href, isExternal},
    navCta{text, href},
    footerCopyright,
    footerLinks[]{label, href, isExternal},
    supportEmail,
    defaultSeo{title, description, ogImage{${imageFields}}}
  }
`;

const DEFAULT_LOCALE = "en";

export async function fetchPage(slug: string, locale: string = DEFAULT_LOCALE) {
  if (!client) return null;
  const run = (l: string) =>
    client!.fetch(
      pageQuery,
      { slug, locale: l },
      {
        next: { tags: ["sanity", "sanity:page", `sanity:page:${slug}`] },
      },
    );
  const primary = await run(locale);
  if (primary) return primary;
  if (locale === DEFAULT_LOCALE) return null;
  return run(DEFAULT_LOCALE);
}

export async function fetchSiteSettings(locale: string = DEFAULT_LOCALE) {
  if (!client) return null;
  const run = (l: string) =>
    client!.fetch(
      siteSettingsQuery,
      { locale: l },
      {
        next: { tags: ["sanity", "sanity:siteSettings"] },
      },
    );
  const primary = await run(locale);
  if (primary) return primary;
  if (locale === DEFAULT_LOCALE) return null;
  return run(DEFAULT_LOCALE);
}

export const supportPageQuery = /* groq */ `
  *[_type == "supportPage" && coalesce(language, "en") == $locale][0]{
    title,
    description,
    seo{title, description, ogImage{${imageFields}}},
    statusPageUrl,
    statusLabel,
    contactEmail
  }
`;

export async function fetchSupportPage(locale: string = DEFAULT_LOCALE) {
  if (!client) return null;
  const run = (l: string) =>
    client!.fetch(
      supportPageQuery,
      { locale: l },
      {
        next: { tags: ["sanity", "sanity:supportPage"] },
      },
    );
  const primary = await run(locale);
  if (primary) return primary;
  if (locale === DEFAULT_LOCALE) return null;
  return run(DEFAULT_LOCALE);
}

const pageUpdatedAtQuery = /* groq */ `
  *[_type == "landingPage"
    && slug.current == $slug
    && coalesce(language, "en") == $locale
  ][0]{ _updatedAt }
`;

export async function fetchPageUpdatedAt(
  slug: string,
  locale: string = DEFAULT_LOCALE,
): Promise<string | null> {
  if (!client) return null;
  const run = async (l: string): Promise<string | null> => {
    const result = await client!.fetch(
      pageUpdatedAtQuery,
      { slug, locale: l },
      {
        next: { tags: ["sanity", `sanity:page:${slug}`] },
      },
    );
    return result?._updatedAt ?? null;
  };
  const primary = await run(locale);
  if (primary) return primary;
  if (locale === DEFAULT_LOCALE) return null;
  return run(DEFAULT_LOCALE);
}
