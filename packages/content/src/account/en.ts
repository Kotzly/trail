export const accountCopy = {
  meta: {
    title: "Trail Account",
    description: "Manage your Trail account, trails, and billing in one place.",
  },
  nav: {
    dashboard: "Dashboard",
    trails: "Trails",
    settings: "Account",
    billing: "Billing",
    signIn: "Sign in",
    signOut: "Sign out",
  },
  home: {
    eyebrow: "Trail account",
    title: "Keep your trails in sync",
    subtitle:
      "Sign in to connect the extension, review activity, and manage your workspace from one place.",
    primaryCta: "Continue with Trail",
    secondaryCta: "Visit gettrail.net",
    highlights: [
      {
        title: "Sync automatically",
        copy: "Trails flow in from the extension in real time."
      },
      {
        title: "Stay organized",
        copy: "Keep your team’s journeys and steps in a single workspace."
      },
      {
        title: "Control access",
        copy: "Manage who can view, capture, and share trails."
      }
    ],
    steps: [
      {
        title: "Open the extension",
        copy: "Sign in inside the extension to start the secure handoff."
      },
      {
        title: "Approve the connection",
        copy: "Confirm it here in seconds—no codes to copy."
      },
      {
        title: "Review your trails",
        copy: "Your dashboard updates as soon as you capture a flow."
      }
    ]
  },
  dashboard: {
    title: "Dashboard",
    subtitle: "Your recent trails and activity will appear here.",
    emptyState: "No trails yet — open the extension to start syncing.",
  },
  settings: {
    title: "Account",
    subtitle: "Profile, security, and workspace preferences.",
  },
  billing: {
    title: "Billing",
    subtitle:
      "Polar integration is coming soon. You will be able to manage plans and invoices here.",
    cta: "Join the billing waitlist",
  },
  extension: {
    title: "Connect the extension",
    subtitle: "Approve the connection from your browser to finish signing in.",
    action: "Open extension",
    success: "Connection approved",
    instructions: "You can return to the extension now.",
  },
} as const;

export type AccountCopy = typeof accountCopy;
