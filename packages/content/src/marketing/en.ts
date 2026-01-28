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
    support: "support",
    signIn: "sign in",
    getStarted: "get the extension",
  },
  support: {
    meta: {
      title: "support · trail",
      description: "Get help with trail, the browser extension, and your account.",
    },
    eyebrow: "support",
    title: "Get help, stay in flow.",
    subtitle:
      "Email us or skim the quick checks below. A couple details help us help you faster.",
    email: "support@gettrail.net",
    actions: {
      email: "email support",
      featureRequest: "request a feature",
      faq: "open the FAQ",
      downloads: "extension downloads",
      signIn: "sign in",
      signInHref: "https://my.gettrail.net/auth/login",
    },
    featureRequest: {
      title: "Feature requests",
      subtitle:
        "Tell us what you are trying to do and what is blocking you. We prioritize by impact + frequency.",
      includeTitle: "Feature request template",
      include: [
        "What problem are you solving?",
        "Your ideal flow (what you wish Trail did).",
        "Workarounds you tried.",
        "How often you need this.",
        "Any example links or screenshots.",
      ],
    },
    includeTitle: "Include this in your message",
    include: [
      "Your account email (or the email you tried).",
      "Browser + version (Chrome / Brave / Edge).",
      "Extension version (from chrome://extensions).",
      "What you expected vs. what happened.",
      "Steps to reproduce (what you clicked).",
    ],
    quickChecksTitle: "Quick checks",
    quickChecks: [
      "Refresh the page and try again (hard refresh if sign-in looks stuck).",
      "Make sure the extension is enabled and up to date.",
      "Try an incognito window to rule out extension conflicts.",
    ],
    faqTitle: "Common questions",
    faqNote: "More answers live in the full FAQ.",
    faqCta: "Read the full FAQ",
  },
  hero: {
    pill: "browser extension · free beta",
    lead: "turn browsing into",
    words: [
      "shareable research trails",
      "clear decisions",
      "team-ready context",
      "repeatable workflows",
      "lightweight summaries",
      "a calm trail",
    ],
    summary:
      "capture every meaningful step, add notes when it matters, and share a trail instead of a tab dump.",
    ctaPrimary: "get the extension",
    ctaSecondary: "see the 60s demo",
  },
  stats: [
    { label: "hours captured (30 days)", value: "300+" },
    { label: "trails created", value: "2,300+" },
    { label: "links shared", value: "4,800+" },
    { label: "avg. session length", value: "42 min" },
  ],
  statsNote: "Based on internal usage from the last 30 days.",
  showcase: {
    title: "see trail in action",
    subtitle: "a quick tour of capture → curate → share in under a minute.",
  },
  features: {
    eyebrow: "features",
    title: "everything you need to stay in flow.",
    summary:
      "trail stays out of the way while you browse, then turns your history into a clean, shareable trail.",
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
      "capture what matters, curate the highlights, and return with full context when you need it.",
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
  downloads: {
    meta: {
      title: "downloads · trail",
    description:
      "get the trail browser extension. download links open in waves, with more platforms on the way.",
    },
    eyebrow: "downloads",
    title: "install trail where you work",
    subtitle:
      "downloads are opening in waves. join the list and we will email you as soon as your browser build is ready.",
    primaryCta: "join the waitlist",
    secondaryCta: "sign in",
    cards: [
      {
        title: "Chrome extension",
        status: "waitlist",
        copy: "optimized for chrome and chromium browsers with the full sidepanel experience.",
      },
      {
        title: "Firefox extension",
        status: "in progress",
        copy: "the same capture flow and sync, tailored for firefox.",
      },
    ],
    stepsTitle: "what happens next",
    steps: [
      {
        title: "install the extension",
        copy: "we will email you the install link when your browser build is ready.",
      },
      {
        title: "sign in to trail",
        copy: "one account keeps your extension and dashboard in sync.",
      },
      {
        title: "capture your flow",
        copy: "every search, tab, and decision snaps into a shareable trail.",
      },
    ],
    noteTitle: "already installed?",
    noteCopy: "open the extension to sign in and start capturing trails immediately.",
    noteCta: "sign in to trail",
    noteCtaHref: "https://my.gettrail.net/auth/login",
  },
  cta: {
    title: "ready to map your browsing?",
    subtitle: "install the extension, then sign in to sync and collaborate.",
    primary: "open downloads",
    secondary: "sign in",
    note: "Free plan available · 30-second install · Privacy-first",
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
