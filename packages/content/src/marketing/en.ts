export const marketingCopy = {
  meta: {
    title: "trail",
    description:
      "trail turns messy tab sessions into structured trails. keep every decision, source, and next step in one place.",
  },
  nav: {
    features: "features",
    pricing: "pricing",
    faq: "faq",
    support: "support",
    signIn: "sign in",
    getStarted: "get the extension",
  },
  footer: {
    copyright: "trail",
    links: {
      faq: "FAQ",
      support: "Support",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      signIn: "Sign in",
      email: "support@gettrail.net",
    },
  },
  support: {
    meta: {
      title: "support · trail",
      description: "get help with Trail, the browser extension, and your account.",
    },
    eyebrow: "support",
    title: "get help, stay in flow.",
    subtitle:
      "Email us or skim the quick checks below. A couple details help us help you faster.",
    email: "support@gettrail.net",
    actions: {
      email: "email support",
      featureRequest: "request a feature",
      faq: "open the FAQ",
      downloads: "extension downloads",
      signIn: "sign in",
      signInHref: "https://app.gettrail.net/auth/login",
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
    pill: "Browser extension · free beta",
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
    ctaPrimary: "get started",
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
  testimonialsSection: {
    eyebrow: "testimonials",
    title: "real teams, calmer trails.",
    summary:
      "researchers, designers, and PMs use trail to keep decisions, sources, and context together.",
  },
  testimonials: [
    {
      name: "Maya C.",
      role: "Research Lead, Fintech Studio",
      quote:
        "Trail removed the tab chaos. We stop losing decisions even when research runs for weeks.",
      image: "/assets/people/maya.jpg",
    },
    {
      name: "Sofia P.",
      role: "UX Researcher",
      quote:
        "Trail stays out of the way. Collecting sources and notes feels fast and clean.",
      image: "/assets/people/sofia.jpg",
    },
    {
      name: "Olivia G.",
      role: "Growth Analyst",
      quote: "One link instead of a long recap. The team jumps in with full context.",
      image: "/assets/people/olivia.jpg",
    },
    {
      name: "Daniel R.",
      role: "Product Manager, AI Team",
      quote: "Trail saves hours. Open a trail and continue exactly where you left off.",
      image: "/assets/people/daniel.jpg",
    },
    {
      name: "Jamal R.",
      role: "PMM",
      quote: "We share context, not screenshots. Syncs move faster.",
      image: "/assets/people/jamal.jpg",
    },
    {
      name: "Alex B.",
      role: "Data Scientist",
      quote: "Returning to a topic no longer takes hours. Trail preserves the path.",
      image: "/assets/people/alex.jpg",
    },
    {
      name: "Priya S.",
      role: "Strategy Lead",
      quote: "Stakeholders finally see the full trail, not just a summary slide.",
      image:
        "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=200&q=80",
    },
    {
      name: "Lucas M.",
      role: "Security Researcher",
      quote: "Trail keeps an audit-friendly record of every source we used.",
      image:
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80",
    },
    {
      name: "Ana L.",
      role: "Product Designer",
      quote: "Switching between map views helps me explain research paths fast.",
      image:
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80",
    },
  ],
  features: {
    eyebrow: "features",
    title: "everything you need to stay in flow.",
    summary:
      "trail stays out of the way while you browse, then turns your history into a clean, shareable trail.",
    items: [
      {
        id: "capture",
        name: "always-on capture",
        description:
          "trail logs searches, sources, and decisions while you work—no manual cleanup.",
        href: "/#showcase",
        cta: "see capture",
        className: "lg:row-start-1 lg:row-end-4 lg:col-start-2 lg:col-end-3",
      },
      {
        id: "search",
        name: "instant rewind search",
        description:
          "jump back to any page or query without hunting through tabs or history.",
        href: "/#showcase",
        cta: "jump back",
        className: "lg:col-start-1 lg:col-end-2 lg:row-start-1 lg:row-end-3",
      },
      {
        id: "views",
        name: "multi-view maps",
        description:
          "switch between tree, radial, and mindmap views to match how you think.",
        href: "/#make-trail-yours",
        cta: "explore views",
        className: "lg:col-start-1 lg:col-end-2 lg:row-start-3 lg:row-end-4",
      },
      {
        id: "share",
        name: "shareable trails",
        description:
          "send a single link that preserves sources, notes, and decisions.",
        href: "/#pricing",
        cta: "share context",
        className: "lg:col-start-3 lg:col-end-4 lg:row-start-1 lg:row-end-3",
      },
      {
        id: "polish",
        name: "export-ready summaries",
        description:
          "export highlights with built-in structure for briefs and reports.",
        href: "/#pricing",
        cta: "ship the recap",
        className: "lg:col-start-3 lg:col-end-4 lg:row-start-3 lg:row-end-4",
      },
    ],
  },
  personalization: {
    eyebrow: "make trail truly yours",
    title: "personalization",
    summary:
      "dial in themes, views, and layouts so every trail matches the way you think.",
    cards: [
      {
        title: "Theme picker",
        description: "match trail to your workspace with quick palette swaps.",
        icon: "palette",
        layout: "md:[grid-area:1/1/2/7] xl:[grid-area:1/1/2/5]",
      },
      {
        title: "View modes",
        description: "tree, radial, or mindmap layouts for every research style.",
        icon: "wand",
        layout: "md:[grid-area:1/7/2/13] xl:[grid-area:2/1/3/5]",
      },
      {
        title: "Layout blocks",
        description: "resize panels, pin notes, and keep the essentials visible.",
        icon: "layout",
        layout: "md:[grid-area:2/1/3/7] xl:[grid-area:1/5/3/8]",
      },
      {
        title: "Highlights & decisions",
        description: "mark the moments that matter and keep stakeholders aligned.",
        icon: "sparkles",
        layout: "md:[grid-area:2/7/3/13] xl:[grid-area:1/8/2/13]",
      },
      {
        title: "Shareable snapshots",
        description: "publish a clean trail view without extra cleanup.",
        icon: "share",
        layout: "md:[grid-area:3/1/4/13] xl:[grid-area:2/8/3/13]",
      },
    ],
    videos: {
      left: [
        {
          title: "Theme picker",
          description: "swap palettes in seconds.",
          type: "image",
          src:
            "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80",
          alt: "Theme picker preview",
        },
        {
          title: "Flexible layouts",
          description: "rearrange panels to fit your flow.",
          type: "image",
          src:
            "https://images.unsplash.com/photo-1487017159836-4e23ece2e4cf?auto=format&fit=crop&w=1200&q=80",
          alt: "Flexible layout preview",
        },
      ],
      right: [
        {
          title: "Tree, radial, mindmap",
          description: "switch views for every trail.",
          type: "image",
          src:
            "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80",
          alt: "Trail view preview",
        },
        {
          title: "Trail highlights",
          description: "pin the key moments for fast handoff.",
          type: "image",
          src:
            "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
          alt: "Trail highlight preview",
        },
      ],
    },
  },
  pricing: {
    eyebrow: "pricing",
    title: "plans that scale with your research",
    description:
      "start free, upgrade when you need sync and sharing.\nannual billing saves 20%.",
    toggleLabel: "annual billing",
    toggleNote: "save 20%",
    billedMonthlyLabel: "billed monthly",
    billedAnnuallyLabel: "billed annually",
    popularBadge: "popular",
    plans: [
      {
        name: "Free",
        price: "0",
        yearlyPrice: "0",
        period: "per month",
        features: [
          "3 trees in history",
          "no sync across devices",
          "local-only data",
          "no online features",
        ],
        description: "for personal trails and local-only research.",
        buttonText: "Get started",
        href: "/downloads",
        isPopular: false,
      },
      {
        name: "Pro",
        price: "10",
        yearlyPrice: "8",
        period: "per month",
        features: [
          "unlimited trees in history",
          "sync across devices",
          "10 devices per account",
          "online features",
          "premium support",
          "shareable trails",
        ],
        description: "for solo builders who need sync + sharing.",
        buttonText: "Go Pro",
        href: "/downloads",
        isPopular: true,
      },
      {
        name: "Team",
        price: "20",
        yearlyPrice: "16",
        period: "per month",
        features: [
          "unlimited trees in history",
          "sync across devices and teams",
          "online features",
          "shared workspaces",
          "team analytics",
          "admin controls",
        ],
        description: "for teams coordinating research at scale.",
        buttonText: "Start Team",
        href: "/downloads",
        isPopular: false,
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
    noteCtaHref: "https://app.gettrail.net/auth/login",
  },
  cta: {
    title: "ready to map your browsing?",
    subtitle: "install the extension, then sign in to sync and collaborate.",
    primary: "open downloads",
    secondary: "sign in",
    openExtension: "open trail [temp button]",
    openExtensionLoading: "opening trail...",
    openExtensionNotFound: "extension not detected.",
    openExtensionInstallCta: "get the extension",
    note: "Free plan available · 30-second install · Privacy-first",
  },
  faq: {
    title: "frequently asked questions",
    items: [
      {
        question: "what does trail capture?",
        answer:
          "trail records URLs, titles, timestamps, and your notes. it does not read page content.",
      },
      {
        question: "is my data private?",
        answer:
          "you control what gets synced and shared. trails are private by default until you share them.",
      },
      {
        question: "can i share or export trails?",
        answer:
          "yes. share a trail link with collaborators and export highlights for reports or docs.",
      },
      {
        question: "does trail work for teams?",
        answer:
          "yes. sharing trails keeps teammates aligned on sources, decisions, and context.",
      },
      {
        question: "does trail work offline?",
        answer:
          "you can keep browsing offline, but syncing and sharing require a connection.",
      },
      {
        question: "which browsers are supported?",
        answer: "trail supports chromium-based browsers including Chrome, Brave, Edge, and more.",
      },
    ],
  },
} as const;

export type MarketingCopy = typeof marketingCopy;
