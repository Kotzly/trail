export const accountCopy = {
  meta: {
    title: "Trail Account",
    description: "Manage your Trail account, security, and data in one place."
  },
  nav: {
    dashboard: "Dashboard",
    settings: "Account",
    billing: "Billing",
    extension: "Extension",
    signIn: "Sign in",
    signOut: "Sign out"
  },
  dashboard: {
    title: "Dashboard",
    subtitle: "See what is live, what is next, and your sync status at a glance.",
    cta: "Connect extension",
    hero: {
      eyebrow: "Activation",
      title: "Connect your Trail extension",
      subtitle: "Start syncing trails to unlock activity, insights, and session control.",
      bannerTitle: "Early access is active",
      bannerDescription: "You are ready to connect the browser extension and begin syncing."
    },
    onboarding: {
      eyebrow: "Onboarding",
      title: "Setup progress",
      subtitle: "Complete the essentials to unlock your first trail.",
      progress: "0/3",
      cta: "Connect extension",
      steps: [
        {
          title: "Connect the extension",
          description: "Approve the connection from your browser."
        },
        {
          title: "Capture a trail",
          description: "Record a flow to populate the dashboard."
        },
        {
          title: "Review + share",
          description: "Organize trails and prepare to invite teammates."
        }
      ]
    },
    recent: {
      title: "Recent trails",
      subtitle: "Your latest activity appears here once sync is enabled."
    },
    empty: {
      title: "No trails yet",
      description: "Connect the extension to start recording real workflows.",
      items: [
        "Capture trails from every active tab",
        "Auto-organize sessions and timestamps",
        "Review and share from the dashboard"
      ],
      cta: "Connect extension",
      secondaryCta: "Account settings"
    },
    status: {
      title: "Status + sessions + actions",
      subtitle: "Health, sessions, and shortcuts in one place.",
      cardTitle: "Status and actions",
      cardSubtitle: "Keep sync running and manage sessions quickly.",
      online: "Online",
      checking: "Checking",
      stats: {
        sync: "Sync",
        sessions: "Sessions",
        sessionsCaption: "Across connected devices",
        trails: "Trails",
        trailsCaption: "Captured this month"
      },
      actions: {
        extension: "Open extension",
        settings: "Account",
        billing: "Billing"
      }
    },
    insights: {
      title: "Insights",
      subtitle: "Totals and trends surface after your first sync.",
      stats: {
        coverage: "Coverage",
        coverageCaption: "Top workflows mapped",
        lastTrail: "Last trail",
        lastTrailCaption: "Most recent capture"
      },
      footerActive: "Nice work, {name}. Your next insight unlocks after two more trails.",
      footerEmpty: "Insights will appear once trails start syncing."
    }
  },
  settings: {
    title: "Account",
    subtitle: "Profile, security, workspace, and data preferences.",
    cta: "Edit profile",
    profile: {
      title: "Profile",
      subtitle: "Name, email, and avatar are managed through Auth0.",
      manageCta: "Manage in Auth0",
      signOutCta: "Sign out",
      fallbackName: "Trail member",
      fallbackEmail: "Signed in"
    },
    security: {
      title: "Security",
      subtitle: "Review active sessions and update your password.",
      changePasswordCta: "Change password",
      signOutEverywhereCta: "Sign out everywhere",
      currentSession: "Current session",
      currentLocation: "This device",
      currentActivity: "Active now"
    },
    workspace: {
      title: "Workspace",
      subtitle: "Solo today, team workspaces soon.",
      soloTitle: "Solo workspace",
      soloDescription: "Single member, private trails",
      soloBadge: "Active",
      teamTitle: "Team workspace",
      teamDescription: "Shared trails, roles, and analytics",
      comingSoon: "Coming soon"
    },
    notifications: {
      title: "Notifications",
      subtitle: "Control what updates you receive.",
      items: ["Product updates", "New insights", "Billing alerts"],
      status: "Soon"
    },
    data: {
      title: "Data & privacy",
      subtitle: "Export or delete data when the tools arrive.",
      exportTitle: "Export data",
      exportDescription: "Request a full export of your synced trails.",
      exportCta: "Request export",
      deleteTitle: "Delete account",
      deleteDescription: "Submit a request to remove all synced data.",
      deleteCta: "Request deletion",
      supportText: "Need help now?",
      supportCta: "Contact support"
    }
  },
  billing: {
    title: "Billing",
    subtitle: "Early access preview of plans and pricing.",
    cta: "Join the waitlist",
    badgeEarly: "Early access",
    badgePreview: "Plans preview",
    waitlistTitle: "Stay in the loop",
    waitlistSubtitle: "Be first to know when billing launches.",
    waitlistDialogTitle: "Get billing updates",
    waitlistDialogDescription: "Share your email and we will notify you when billing opens.",
    waitlistNote: "You will only get updates about billing availability.",
    plansTitle: "Plans preview",
    plansSubtitle: "Pricing is illustrative while we finalize usage tiers.",
    planHighlight: "Most popular",
    planFree: "Free",
    planPerMonth: "per month",
    planCta: "Coming soon"
  },
  extension: {
    title: "Extension",
    subtitle: "Manage sessions and device access for Trail sync.",
    cta: "Open extension",
    empty: {
      title: "Connect your extension",
      description: "Approve the connection to unlock session management.",
      items: [
        "Create secure device sessions",
        "Review last seen activity",
        "Revoke access anytime"
      ],
      cta: "Open extension",
      ctaHref: "/extension"
    },
    connected: {
      title: "Extension connected",
      subtitle: "Your browser is linked and ready to sync trails.",
      badge: "Connected",
      stats: {
        status: "Connection",
        value: "Healthy",
        caption: "Ready for sync",
        permissions: "Permissions",
        permissionsValue: "Approved",
        permissionsCaption: "Browsing + session data"
      }
    },
    device: {
      title: "Device overview",
      subtitle: "Sessions appear as soon as the extension syncs.",
      primaryDevice: "Primary device",
      primaryDeviceCaption: "This device",
      lastSeen: "Last seen",
      lastSeenValue: "Just now",
      lastSeenCaption: "When the extension checked in",
      connected: "Connected"
    },
    sessions: {
      title: "Session manager",
      subtitle: "Revoke access by device once sessions are available.",
      revokeAll: "Revoke all",
      revoke: "Revoke",
      empty: "Sessions are coming soon. Connect the extension to populate this list."
    }
  }
} as const;

export type AccountCopy = typeof accountCopy;
