export const marketingCopy = {
  meta: {
    title: "Trail — Calm navigation intelligence for modern teams",
    description:
      "Trail turns scattered browsing into a shared, searchable map. Save context, stay oriented, and never lose the path.",
  },
  nav: {
    product: "Product",
    howItWorks: "How it works",
    security: "Security",
    faq: "FAQ",
    signIn: "Sign in",
    getStarted: "Get started",
  },
  hero: {
    badge: "Navigation memory for the modern web",
    title: "Never lose the thread again.",
    subtitle:
      "Trail captures your browsing as a living graph so you can recall, share, and resume any trail in seconds.",
    primaryCta: "Start with the extension",
    secondaryCta: "Open your account",
    note: "Free while we build the billing experience.",
  },
  highlights: {
    title: "Built for deep work and fast recall",
    items: [
      {
        title: "Graph-first memory",
        description: "See every tab as a node. Pin, tag, and reshape the trail your way.",
      },
      {
        title: "Instant context",
        description: "Search by title, URL, or tag and jump to the right tab instantly.",
      },
      {
        title: "Focused by default",
        description: "Light and dark themes tuned for clarity, with glass-like surfaces.",
      },
    ],
  },
  howItWorks: {
    title: "How Trail works",
    steps: [
      {
        title: "Capture",
        description: "Trail listens to navigation events and builds a live map automatically.",
      },
      {
        title: "Organize",
        description: "Use pins, tags, and layouts to keep long research sessions tidy.",
      },
      {
        title: "Recall",
        description: "Reopen any path, share a trail, or jump to the exact page you need.",
      },
    ],
  },
  security: {
    title: "Security & privacy",
    body:
      "Trail stores your navigation graph locally in the extension. When you connect an account, we only sync the metadata you explicitly choose.",
    bullets: [
      "Local-first storage by default",
      "Encrypted transport for account sync",
      "Granular controls for shared trails",
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
