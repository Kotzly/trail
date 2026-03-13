/**
 * Seed script -- run with `npx tsx scripts/seed.ts`
 * Creates the home page document + siteSettings in Sanity
 */
import { createClient } from "@sanity/client";

const client = createClient({
  projectId: "qejrh1jd",
  dataset: "production",
  apiVersion: "2025-06-01",
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
});

async function seed() {
  console.log("Seeding Sanity...");

  // ---------------------------------------------------------------------------
  // Site Settings (singleton)
  // ---------------------------------------------------------------------------
  console.log("  Creating siteSettings...");
  await client.createOrReplace({
    _id: "siteSettings",
    _type: "siteSettings",
    siteName: "Trail",
    siteUrl: "https://www.gettrail.net",
    nav: [
      { _key: "nav-features", label: "Features", href: "/#features", isExternal: false },
      { _key: "nav-pricing", label: "Pricing", href: "/#pricing", isExternal: false },
      { _key: "nav-support", label: "Support", href: "/support", isExternal: false },
    ],
    footerCopyright: "Trail",
    footerLinks: [
      { _key: "fl-support", label: "Support", href: "/support", isExternal: false },
      { _key: "fl-privacy", label: "Privacy Policy", href: "/privacy", isExternal: false },
      { _key: "fl-terms", label: "Terms of Service", href: "/terms", isExternal: false },
    ],
    supportEmail: "support@gettrail.net",
    defaultSeo: {
      title: "Trail — Visual Browsing History",
      description:
        "Capture every meaningful step as you browse. Trail turns tab chaos into organized research paths.",
    },
  });

  // ---------------------------------------------------------------------------
  // Home Page (singleton UUID matches sanity.config.ts)
  // ---------------------------------------------------------------------------
  console.log("  Creating home page...");
  await client.createOrReplace({
    _id: "042dbb5a-4a60-4cde-8076-97f3e1293d36",
    _type: "landingPage",
    title: "Home",
    slug: { _type: "slug", current: "home" },
    seo: {
      title: "Trail — Visual Browsing History",
      description:
        "Capture every meaningful step as you browse. Trail turns tab chaos into organized research paths.",
    },
    sections: [
      {
        _type: "heroSection",
        _key: "hero",
        eyebrow: "Browser app",
        title: "Turn browsing into",
        rotatingWords: [
          "shareable research paths",
          "clear decisions",
          "team-ready context",
        ],
        description:
          "Capture every meaningful step, add notes when it matters, and share a clean research path instead of a tab dump.",
        ctas: [
          { _key: "cta-primary", text: "Get Trail", href: "/downloads", variant: "primary" },
        ],
      },
      {
        _type: "bentoFeaturesSection",
        _key: "features",
        eyebrow: "Features",
        title: "Everything you need to stay in flow.",
        summary:
          "The workspace stays out of the way while you browse, then turns your history into a clean, shareable path.",
        features: [
          {
            _key: "f-capture",
            id: "capture",
            name: "Always-on capture",
            description: "The app logs searches, sources, and decisions while you work.",
          },
          {
            _key: "f-search",
            id: "search",
            name: "Instant rewind search",
            description: "Jump back to any page or query without hunting through tabs or history.",
          },
          {
            _key: "f-views",
            id: "visualize",
            name: "Multi-view maps",
            description: "Switch between tree, radial, and mindmap views to match how you think.",
          },
          {
            _key: "f-share",
            id: "share",
            name: "Shareable paths",
            description: "Send a single link that preserves sources, notes, and decisions.",
          },
          {
            _key: "f-custom",
            id: "customize",
            name: "Customizable views",
            description: "Customize the app to your workflow with themes, views, and layouts.",
          },
        ],
      },
      {
        _type: "ctaSection",
        _key: "cta",
        eyebrow: "Ready to get started?",
        title: "Transform your research workflow",
        description: "Join researchers who use Trail to organize their browsing and share insights.",
        primaryCta: { _key: "cta-p", text: "Get the extension", href: "/downloads", variant: "primary" },
      },
    ],
  });

  console.log("Seeding complete!");
  console.log("   Remember to publish documents in Sanity Studio.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
