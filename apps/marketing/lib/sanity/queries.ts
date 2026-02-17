import { client } from "./client";

// ---------------------------------------------------------------------------
// GROQ queries
// ---------------------------------------------------------------------------

const imageFields = `
  asset->{_id, url, metadata{dimensions}},
  hotspot, crop
`;

const fileFields = `
  asset->{_id, url}
`;

export const pageQuery = /* groq */ `
  *[_type in ["landingPage", "page"] && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    seo{title, description, ogImage{${imageFields}}},
    sections[]{
      _type,
      _key,
      ...,
      // Resolve file/image assets inside sections
      video{${fileFields}},
      poster{${imageFields}},
      "items": items[]{
        ...,
        video{${fileFields}},
        image{${imageFields}},
        logo{${imageFields}}
      },
      "brands": brands[]{
        ...,
        logo{${imageFields}}
      },
      "features": features[]{...},
      "methods": methods[]{...},
      "options": options[]{...},
      "browsers": browsers[]{...},
      "steps": steps[]{...},
      "plans": plans[]{...},
      "stats": stats[]{...},
      "values": values[]{...},
      "subjects": subjects[]{...},
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

export const legalPageQuery = /* groq */ `
  *[_type == "legalPage" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    lastUpdated,
    body,
    seo{title, description, ogImage{${imageFields}}}
  }
`;

export const allPagesQuery = /* groq */ `
  *[_type in ["landingPage", "page"]]{
    "slug": slug.current
  }
`;

// ---------------------------------------------------------------------------
// Fetch helpers (with Next.js cache tags for on-demand ISR)
// ---------------------------------------------------------------------------

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

export async function fetchLegalPage(slug: string) {
  return client.fetch(legalPageQuery, { slug }, {
    next: { tags: ["sanity", "sanity:legalPage", `sanity:legalPage:${slug}`] },
  });
}
