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
  console.log("🌱 Seeding Sanity...");

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
      { _key: "nav-features", label: "Features", href: "/features", isExternal: false },
      { _key: "nav-pricing", label: "Pricing", href: "/pricing", isExternal: false },
      { _key: "nav-faq", label: "FAQ", href: "/faq", isExternal: false },
      { _key: "nav-support", label: "Support", href: "/support", isExternal: false },
    ],
    footerCopyright: "Trail",
    footerLinks: [
      { _key: "fl-faq", label: "FAQ", href: "/faq", isExternal: false },
      { _key: "fl-support", label: "Support", href: "/support", isExternal: false },
      { _key: "fl-about", label: "About", href: "/about", isExternal: false },
      { _key: "fl-contact", label: "Contact", href: "/contact", isExternal: false },
      { _key: "fl-privacy", label: "Privacy Policy", href: "/privacy", isExternal: false },
      { _key: "fl-terms", label: "Terms of Service", href: "/terms", isExternal: false },
    ],
    supportEmail: "support@gettrail.net",
    defaultSeo: {
      title: "Trail — Privacy-first research trails",
      description:
        "Capture sources, notes, and decisions as you browse. Trail turns tab chaos into organized research trails you can share without storing page content.",
    },
  });

  // ---------------------------------------------------------------------------
  // Home Page
  // ---------------------------------------------------------------------------
  console.log("  Creating home page...");
  await client.createOrReplace({
    _id: "page-home",
    _type: "page",
    title: "Home",
    slug: { _type: "slug", current: "home" },
    seo: {
      title: "Trail — Privacy-first research trails",
      description:
        "Capture sources, notes, and decisions as you browse. Trail turns tab chaos into organized research trails.",
    },
    sections: [
      {
        _type: "heroSection",
        _key: "hero",
        eyebrow: "Browser app · free beta",
        title: "Turn browsing into",
        rotatingWords: [
          "shareable research paths",
          "clear decisions",
          "team-ready context",
          "repeatable workflows",
          "lightweight summaries",
          "a calm research path",
        ],
        description:
          "Capture every meaningful step, add notes when it matters, and share a clean research path instead of a tab dump.",
        ctas: [
          { _key: "cta-primary", text: "Get Trail", href: "/downloads", variant: "primary" },
        ],
      },
      {
        _type: "trustedBySection",
        _key: "trusted",
        title: "Trusted by power users at",
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
            description: "The app logs searches, sources, and decisions while you work—no manual cleanup.",
            href: "/#showcase",
            cta: "See capture",
            className: "lg:row-start-1 lg:row-end-2 lg:col-start-2 lg:col-end-3",
          },
          {
            _key: "f-search",
            id: "search",
            name: "Instant rewind search",
            description: "Jump back to any page or query without hunting through tabs or history.",
            href: "/#showcase",
            cta: "Jump back",
            className: "lg:col-start-1 lg:col-end-2 lg:row-start-1 lg:row-end-3",
          },
          {
            _key: "f-views",
            id: "views",
            name: "Multi-view maps",
            description: "Switch between tree, radial, and mindmap views to match how you think.",
            href: "/#make-trail-yours",
            cta: "Explore views",
            className: "lg:col-start-1 lg:col-end-2 lg:row-start-3 lg:row-end-4",
          },
          {
            _key: "f-share",
            id: "share",
            name: "Shareable paths",
            description: "Send a single link that preserves sources, notes, and decisions.",
            href: "/#pricing",
            cta: "Share context",
            className: "lg:col-start-3 lg:col-end-4 lg:row-start-1 lg:row-end-3",
          },
          {
            _key: "f-polish",
            id: "polish",
            name: "Export-ready summaries",
            description: "Export highlights with built-in structure for briefs and reports.",
            href: "/#pricing",
            cta: "Ship the recap",
            className: "lg:col-start-3 lg:col-end-4 lg:row-start-3 lg:row-end-4",
          },
          {
            _key: "f-custom",
            id: "customization",
            name: "Customizable views",
            description: "Customize the app to your workflow with themes, views, and layouts.",
            href: "/#make-trail-yours",
            cta: "See customizable views",
            className: "lg:col-start-2 lg:row-start-2 lg:row-end-4",
          },
        ],
      },
      {
        _type: "videoShowcasesSection",
        _key: "videos",
        title: "Do it all with Trail.",
        items: [
          {
            _key: "v-capture",
            eyebrow: "Capture & Organize",
            title: "Save every source,\nnever lose context",
            description: "Trail automatically captures URLs, titles, and timestamps as you browse. Add notes when it matters.",
          },
          {
            _key: "v-visualize",
            eyebrow: "Visualize in different ways",
            title: "See your research path as trees, a circle, or a mindmap",
            description: "Switch between tree, radial, and mindmap views. Share a single link with full context.",
          },
          {
            _key: "v-collab",
            eyebrow: "Collaborate & Context",
            title: "Share with your team,\nget context in real-time",
            description: "Share a single link with full context. Get context in real-time.",
          },
          {
            _key: "v-focus",
            eyebrow: "Focus on the important parts",
            title: "Pin the key moments, hide the noise",
            description: "Pin the nodes you need, collapse the nodes you don't.",
          },
          {
            _key: "v-theme",
            eyebrow: "Make Trail truly yours",
            title: "Choose your own theme, layout, and color palette",
            description: "Trail has a beautiful built-in theme picker. You can create practically anything.",
          },
        ],
      },
      {
        _type: "faqSection",
        _key: "faq",
        eyebrow: "FAQ",
        title: "Frequently asked questions",
        items: [
          { _key: "faq-1", question: "What does the app capture?", answer: "Trail records URLs, page titles, timestamps, and your notes. It does not read or store page content, passwords, or form data. Your research context stays private.", category: "privacy" },
          { _key: "faq-2", question: "Is my data private?", answer: "Absolutely. You control what gets synced and shared. Saved paths are private by default until you explicitly share them. We use encryption in transit and at rest.", category: "privacy" },
          { _key: "faq-3", question: "Can I share or export my paths?", answer: "Yes. Share a link with collaborators that preserves all sources, notes, and decisions. Export highlights as structured data for reports or documentation.", category: "features" },
          { _key: "faq-4", question: "Does it work for teams?", answer: "Yes. Shared paths keep teammates aligned on sources, decisions, and context. Team plans include shared workspaces and admin controls.", category: "features" },
          { _key: "faq-5", question: "Does it work offline?", answer: "You can continue browsing and capturing offline. Your data syncs automatically when you reconnect. Some features like sharing require a connection.", category: "technical" },
          { _key: "faq-6", question: "Which browsers are supported?", answer: "Trail supports Chromium-based browsers including Chrome, Brave, Edge, and Arc. Firefox support is coming soon.", category: "technical" },
          { _key: "faq-7", question: "How is this different from browser history?", answer: "Unlike browser history, Trail organizes your journey into meaningful paths with notes, decisions, and context. You can group related tabs, add annotations, and share complete research narratives—not just a list of URLs.", category: "features" },
          { _key: "faq-8", question: "Can I import my existing bookmarks?", answer: "Yes. Import bookmarks from Chrome, Firefox, or Safari to seed your initial trails. The app will organize them by topic and date for you.", category: "features" },
        ],
      },
      {
        _type: "ctaSection",
        _key: "cta",
        eyebrow: "Ready to get started?",
        title: "Transform your",
        rotatingWords: ["research workflow", "team productivity", "decision making"],
        description: "Join thousands of researchers who use Trail to organize their browsing and share insights with their teams.",
        primaryCta: { _key: "cta-p", text: "Get the extension", href: "/downloads", variant: "primary" },
        secondaryCta: { _key: "cta-s", text: "View pricing", href: "/pricing", variant: "secondary" },
        stats: [
          { _key: "s-1", value: "300+", label: "hours captured (30 days)" },
          { _key: "s-2", value: "2,300+", label: "paths created" },
          { _key: "s-3", value: "4,800+", label: "links shared" },
          { _key: "s-4", value: "42 min", label: "avg. session length" },
        ],
        note: "Based on internal usage from the last 30 days.",
      },
    ],
  });

  console.log("✅ Seeding complete!");
  console.log("   Remember to publish documents in Sanity Studio.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
