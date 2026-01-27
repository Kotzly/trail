export const marketingCopy = {
  meta: {
    title: "trail",
    description:
      "trail turns messy tab sessions into structured trails. keep every decision, source, and next step in one place.",
  },
  nav: {
    features: "features",
    workflow: "workflow",
    faq: "F.A.Q.",
    signIn: "",
    getStarted: "get",
  },
  hero: {
    pill: "browser extension · freemium",
    lead: "the best extension for",
    words: ["developers", "researchers", "product teams", "founders", "designers", "writers", "marketers", "analysts",
       "students", "consultants", "knowledge workers", "power users", "anyone who lives in the browser"],
    summary:
      "trail allows you to leverage your browser history to level up your work. you can even manage your tabs with trail. all without leaving the sidepanel.",
    ctaPrimary: "try free",
    ctaSecondary: "learn more",
  },
  stats: [
    { label: "browsing time", value: "300+ hours" },
    { label: "trails created", value: "100+ / hour" },
    { label: "tabs managed", value: "250K+" },
    { label: "research sessions", value: "16K+" },
    { label: "exported trails", value: "2,300+" },
    { label: "avg. session length", value: "42 min" },
    { label: "shared links", value: "4,800+" },
  ],
  showcase: {
    title: "see trail in action",
    subtitle: "gif is yet to come, please wait patiently.",
  },
  features: {
    eyebrow: "features",
    title: "everything you need to stay in flow.",
    summary:
      "trail is designed to feel invisible while you browse, but incredibly powerful when you need to pick a trail back up.",
    cards: [
      {
        title: "auto-captured trails",
        copy: "every search, doc, and decision is logged into a clean trail you can resume in seconds.",
        bullets: ["session timeline", "visited sources", "time spent per page"],
      },
      // { todo: add smart tagging
      //   title: "smart tagging",
      //   copy: "trail tags pages as you browse, so you can filter by topic, client, or research thread.",
      //   bullets: ["Auto topic labels", "Pinned highlights", "One-click follow-ups"],
      // },
      {
        title: "shareable context",
        copy: "send a trail instead of a tab dump. keep the storyline, notes, and decisions intact.",
        bullets: ["exportable summaries", "private links", "team-ready views"],
      },
      {
        title: "one-click search jump",
        copy: "instantly revisit any search or website from your session, no hunting or re-Googling required.",
        bullets: ["effortless revisit", "full search context", "zero friction"],
      },
    ],
  },
  workflow: {
    eyebrow: "workflow",
    title: "a calm trail from search to share.",
    summary:
      "your session stays organized without extra clicks. trail captures the path, helps you curate the best moments, and keeps everything ready for next time.",
    steps: [
      {
        title: "Capture",
        copy: "trail runs as a lightweight browser extension, recording every meaningful step in your session.",
      },
      {
        title: "Curate",
        copy: "highlight key sources, add notes, and pin the moments that matter before you move on.",
      },
      {
        title: "Resume",
        copy: "open a trail later and you are back exactly where you left off, complete with context.",
      },
      {
        title: "Share",
        copy: "send a trail to collaborators so they can jump into the same research path instantly.",
      },
    ],
  },
  cta: {
    title: "ready to map your browsing?",
    subtitle: "install the extension, then unlock your account for sync and collaboration.",
    primary: "install extension",
    secondary: "go to account",
  },
  faq: {
    title: "frequently asked questions",
    items: [
      {
        question: "is trail free?",
        answer:
          "trail is free during the beta. subscriptions will be available later with freemium model.",
      },
      {
        question: "which browsers are supported?",
        answer: "all chromium-based browsers are supported, including Chrome, Brave, Edge, and more.",
      },
      {
        question: "does trail read page content?",
        answer:
          "no. trail focuses on URLs, titles, and metadata to keep the experience lightweight and privacy-first.",
      },
      {
        question: "how does account sync work?",
        answer:
          "account sync will let you back up and share trails. you decide what gets synced.",
      },
    ],
  },
} as const;

export type MarketingCopy = typeof marketingCopy;
