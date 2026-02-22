import { client } from "./client";

const imageFields = `
  asset->{_id, url, metadata{dimensions}},
  hotspot, crop
`;

const fileFields = `
  asset->{_id, url}
`;

export const pageQuery = /* groq */ `
  *[_type == "landingPage" && slug.current == $slug][0]{
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
  *[_type == "siteSettings"][0]{
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

export async function fetchPage(slug: string) {
  return client.fetch(pageQuery, { slug }, {
    next: { tags: ["sanity", "sanity:page", `sanity:page:${slug}`] },
  });
}

export async function fetchSiteSettings() {
  return client.fetch(siteSettingsQuery, {}, {
    next: { tags: ["sanity", "sanity:siteSettings"] },
  });
}
