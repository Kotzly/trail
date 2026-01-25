export const accountCopy = {
  meta: {
    title: "Trail Account",
    description: "Manage your Trail account, trails, and billing in one place.",
  },
  nav: {
    dashboard: "Dashboard",
    trails: "Trails",
    settings: "Settings",
    billing: "Billing",
    signIn: "Sign in",
    signOut: "Sign out",
  },
  home: {
    title: "Welcome to Trail",
    subtitle:
      "Sign in to sync trails, manage your workspace, and get ready for team collaboration.",
    primaryCta: "Sign in",
  },
  dashboard: {
    title: "Dashboard",
    subtitle: "Your recent trails and activity will appear here.",
    emptyState: "No trails yet — connect the extension to get started.",
  },
  settings: {
    title: "Settings",
    subtitle: "Control profile, security, and sync preferences.",
  },
  billing: {
    title: "Billing",
    subtitle:
      "Polar integration is coming soon. You will be able to manage plans and invoices here.",
    cta: "Join the billing waitlist",
  },
  extension: {
    title: "Connect the extension",
    subtitle:
      "Log in from the extension, then confirm the connection in your browser to sync trails.",
    action: "Generate connection code",
    success: "Extension connection code",
    instructions:
      "Paste this one-time code into the extension to complete sign-in.",
  },
} as const;

export type AccountCopy = typeof accountCopy;
