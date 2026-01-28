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
      "Billing tools are coming soon. Manage plans and invoices here once they launch.",
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
