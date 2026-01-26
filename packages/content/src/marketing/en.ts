export const marketingCopy = {
  meta: {
    title: "Trail — the best extension for focused browsing",
    description:
      "Trail turns messy tab sessions into structured trails so you never lose the thread.",
  },
  nav: {
    features: "Features",
    workflow: "Workflow",
    faq: "FAQ",
    signIn: "Sign in",
    getStarted: "Get started",
  },
  hero: {
    pill: "Browser extension · subscription",
    lead: "the best extension for",
    words: ["developers", "researchers", "product teams", "founders", "designers", "writers", "marketers", "analysts",
       "students", "consultants", "knowledge workers", "power users", "anyone who lives in the browser"],
    summary:
      "Trail turns messy tab sessions into structured trails. Keep every decision, source, and next step in one place.",
    ctaPrimary: "Start with the extension",
    ctaSecondary: "See how it works",
  },
  stats: [
    { label: "Avg. resume time", value: "3.2s" },
    { label: "Sources captured", value: "120+ / week" },
    { label: "Auto-tag accuracy", value: "94%" },
    { label: "Context preserved", value: "100%" },
  ],
  showcase: {
    title: "See the trail come alive",
    subtitle: "Drop your GIF at public/showcase.gif to replace this placeholder.",
  },
  features: {
    eyebrow: "Features",
    title: "Everything you need to stay in flow.",
    summary:
      "Trail is designed to feel invisible while you browse, but incredibly powerful when you need to pick a trail back up.",
    cards: [
      {
        title: "Auto-captured trails",
        copy: "Every search, doc, and decision is logged into a clean trail you can resume in seconds.",
        bullets: ["Session timeline", "Visited sources", "Time spent per page"],
      },
      {
        title: "Smart tagging",
        copy: "Trail tags pages as you browse, so you can filter by topic, client, or research thread.",
        bullets: ["Auto topic labels", "Pinned highlights", "One-click follow-ups"],
      },
      {
        title: "Shareable context",
        copy: "Send a trail instead of a tab dump. Keep the storyline, notes, and decisions intact.",
        bullets: ["Exportable summaries", "Private links", "Team-ready views"],
      },
    ],
  },
  workflow: {
    eyebrow: "Workflow",
    title: "A calm trail from search to share.",
    summary:
      "Your session stays organized without extra clicks. Trail captures the path, helps you curate the best moments, and keeps everything ready for next time.",
    steps: [
      {
        title: "Capture",
        copy: "Trail runs as a lightweight browser extension, recording every meaningful step in your session.",
      },
      {
        title: "Curate",
        copy: "Highlight key sources, add notes, and pin the moments that matter before you move on.",
      },
      {
        title: "Resume",
        copy: "Open a trail later and you are back exactly where you left off, complete with context.",
      },
      {
        title: "Share",
        copy: "Send a trail to collaborators so they can jump into the same research path instantly.",
      },
    ],
  },
  cta: {
    title: "Ready to map your browsing?",
    subtitle: "Install the extension, then unlock your account for sync and collaboration.",
    primary: "Install extension",
    secondary: "Go to account",
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      {
        question: "Is Trail free?",
        answer:
          "Trail is free during the beta. Billing will be added later through Polar with founder-friendly pricing.",
      },
      {
        question: "Which browsers are supported?",
        answer: "Chrome and Brave today. More Chromium browsers are next.",
      },
      {
        question: "Does Trail read page content?",
        answer:
          "No. Trail focuses on URLs, titles, and metadata to keep the experience lightweight and privacy-first.",
      },
      {
        question: "How does account sync work?",
        answer:
          "Account sync will let you back up and share trails. You decide what gets synced.",
      },
    ],
  },
} as const;

export type MarketingCopy = typeof marketingCopy;
