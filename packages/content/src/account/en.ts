export const accountCopy = {
  meta: {
    title: "trail account",
    description: "manage your trail account, security, and data in one place."
  },
  brand: {
    name: "trail"
  },
  nav: {
    dashboard: "dashboard",
    activity: "activity",
    gettingStarted: "getting started",
    sessions: "sessions",
    settings: "account",
    billing: "billing",
    extension: "extension",
    signIn: "sign in",
    signOut: "sign out"
  },
  header: {
    searchPlaceholder: "search trails, settings, or billing",
    searchHint: "⌘k",
    navLabel: "navigate",
    navItems: {
      dashboard: "status, sessions, and trails",
      extension: "connect and manage your browser",
      settings: "profile, security, and access",
      billing: "plan, usage, and invoices"
    },
    userMenu: {
      settings: "account settings",
      settingsDescription: "profile, security, and data",
      signOut: "sign out",
      signOutDescription: "end your current session"
    },
    mobileToggleLabel: "toggle menu"
  },
  gettingStarted: {
    title: "getting started",
    subtitle: "complete the setup to unlock your first trails.",
    cta: "connect extension",
    stepsTitle: "setup checklist",
    stepsSubtitle: "finish these steps to start syncing trails.",
    progress: "0/3",
    steps: [
      {
        title: "connect the extension",
        description: "approve the connection from your browser."
      },
      {
        title: "capture a trail",
        description: "record a flow to populate the dashboard."
      },
      {
        title: "review and share",
        description: "organize trails and prepare to invite teammates."
      }
    ],
    next: {
      eyebrow: "what happens next",
      title: "unlock activity and sessions",
      subtitle: "once you sync, trails appear across activity and sessions.",
      items: [
        "activity timeline fills with new trails",
        "sessions list tracks devices and last seen",
        "coverage starts to appear automatically"
      ]
    },
    support: {
      eyebrow: "need help?",
      title: "talk to us",
      subtitle: "we are here to help you finish setup.",
      cta: "contact support"
    }
  },
  activity: {
    title: "activity",
    subtitle: "review recent trails, usage, and sync history.",
    stream: {
      eyebrow: "stream",
      title: "recent trails",
      subtitle: "activity appears after the first sync.",
      filters: ["today", "this week", "all time"]
    },
    empty: {
      title: "no activity yet",
      description: "connect the extension to start capturing real workflows.",
      items: [
        "see synced trails in chronological order",
        "filter by date or device",
        "share when your team is ready"
      ],
      cta: "connect extension",
      secondaryCta: "getting started"
    },
    next: {
      eyebrow: "next sync",
      title: "stay ready to capture",
      subtitle: "the extension keeps your timeline fresh.",
      cta: "open extension"
    },
    coverage: {
      eyebrow: "coverage",
      title: "coverage snapshot",
      subtitle: "coverage appears after your first trail."
    }
  },
  sessions: {
    title: "sessions",
    subtitle: "devices and access control in one place.",
    list: {
      eyebrow: "devices",
      title: "active sessions",
      subtitle: "review devices connected to your account.",
      emptyTitle: "no sessions yet",
      emptyDescription: "sessions appear once the extension connects.",
      emptyItems: [
        "see device name and last seen",
        "revoke access instantly",
        "confirm permission scopes"
      ]
    },
    posture: {
      eyebrow: "security",
      title: "access posture",
      subtitle: "we will flag unusual device changes.",
      items: [
        { label: "permissions", value: "approved" },
        { label: "last review", value: "pending" },
        { label: "alerts", value: "none" }
      ]
    },
    guidance: {
      title: "need to revoke access?",
      description: "open the extension to sign out devices instantly.",
      cta: "open extension"
    }
  },
  dashboard: {
    title: "dashboard",
    subtitle: "see what is live, what is next, and your sync status at a glance.",
    cta: "connect extension",
    activation: {
      eyebrow: "do this now",
      title: "connect the extension",
      subtitle: "start syncing trails to unlock activity and sessions.",
      cta: "connect extension"
    },
    onboarding: {
      title: "setup progress",
      subtitle: "complete the essentials to unlock your first trail.",
      progress: "0/3",
      steps: [
        {
          title: "connect the extension",
          description: "approve the connection from your browser."
        },
        {
          title: "capture a trail",
          description: "record a flow to populate the dashboard."
        },
        {
          title: "review and share",
          description: "organize trails and prepare to invite teammates."
        }
      ]
    },
    nextAction: {
      title: "next up",
      description: "install the browser extension to start capturing trails.",
      cta: "open extension",
      href: "/extension"
    },
    recent: {
      eyebrow: "recent",
      title: "recent trails",
      subtitle: "your latest activity appears here once sync is enabled.",
      emptyCount: "0 trails",
      activeCount: "12 trails"
    },
    empty: {
      title: "no trails yet",
      description: "connect the extension to start recording real workflows.",
      items: [
        "capture trails from every active tab",
        "auto-organize sessions and timestamps",
        "review and share from the dashboard"
      ],
      cta: "connect extension",
      secondaryCta: "account settings"
    },
    status: {
      eyebrow: "status",
      title: "status and actions",
      subtitle: "health, sessions, and shortcuts in one place.",
      online: "online",
      checking: "checking",
      lastSyncFallback: "no sync yet",
      stats: {
        sync: "sync",
        sessions: "sessions",
        sessionsCaption: "across connected devices",
        trails: "trails",
        trailsCaption: "captured this month"
      },
      actions: {
        extension: "open extension",
        settings: "account",
        billing: "billing"
      }
    },
    insights: {
      eyebrow: "insights",
      title: "insights",
      subtitle: "totals and trends surface after your first sync.",
      stats: {
        coverage: "coverage",
        coverageCaption: "top workflows mapped",
        lastTrail: "last trail",
        lastTrailCaption: "most recent capture",
        emptyValue: "—"
      },
      footerActive: "nice work, {name}. your next insight unlocks after two more trails.",
      footerEmpty: "insights will appear once trails start syncing."
    }
  },
  settings: {
    title: "account",
    subtitle: "profile, security, workspace, and data preferences.",
    cta: "edit profile",
    profile: {
      eyebrow: "profile",
      title: "profile",
      subtitle: "name, email, and avatar are managed through auth0.",
      manageCta: "manage in auth0",
      signOutCta: "sign out",
      avatarAlt: "user avatar",
      fallbackName: "trail member",
      fallbackEmail: "signed in"
    },
    security: {
      eyebrow: "security",
      title: "security",
      subtitle: "review active sessions and update your password.",
      changePasswordCta: "change password",
      signOutEverywhereCta: "coming soon",
      currentSession: "current session",
      currentLocation: "this device",
      currentActivity: "active now"
    },
    workspace: {
      eyebrow: "workspace",
      title: "workspace",
      subtitle: "solo today, team workspaces soon.",
      soloTitle: "solo workspace",
      soloDescription: "single member, private trails",
      soloBadge: "active",
      teamTitle: "team workspace",
      teamDescription: "shared trails, roles, and analytics",
      comingSoon: "coming soon"
    },
    notifications: {
      eyebrow: "notifications",
      title: "notifications",
      subtitle: "control what updates you receive.",
      items: ["product updates", "new insights", "billing alerts"],
      status: "soon"
    },
    data: {
      eyebrow: "data and privacy",
      title: "data and privacy",
      subtitle: "export or delete data when the tools arrive.",
      exportTitle: "export data",
      exportDescription: "request a full export of your synced trails.",
      exportCta: "request export",
      exportHref: "mailto:support@gettrail.net?subject=trail%20export%20request",
      deleteTitle: "delete account",
      deleteDescription: "submit a request to remove all synced data.",
      deleteCta: "request deletion",
      deleteHref: "mailto:support@gettrail.net?subject=trail%20deletion%20request",
      supportText: "need help now?",
      supportCta: "contact support"
    }
  },
  billing: {
    title: "billing",
    subtitle: "early access preview of plans and pricing.",
    cta: "join waitlist",
    badgeEarly: "early access",
    badgePreview: "plans preview",
    waitlistDialogTitle: "get billing updates",
    waitlistDialogDescription: "share your email and we will notify you when billing opens.",
    waitlistNote: "pricing is in preview while we finalize usage tiers.",
    planHighlight: "most popular",
    planFree: "free",
    planPerMonth: "per month",
    planCta: "coming soon"
  },
  extension: {
    title: "extension",
    subtitle: "manage sessions and device access for trail sync.",
    cta: "open extension",
    status: {
      eyebrow: "connection",
      title: "extension status",
      subtitle: "link the browser extension to start syncing trails."
    },
    empty: {
      title: "connect your extension",
      description: "approve the connection to unlock session management.",
      items: [
        "create secure device sessions",
        "review last seen activity",
        "revoke access anytime"
      ],
      cta: "open extension",
      ctaHref: "/extension"
    },
    connected: {
      stats: {
        status: "connection",
        value: "healthy",
        caption: "ready for sync",
        permissions: "permissions",
        permissionsValue: "approved",
        permissionsCaption: "browsing and session data"
      }
    },
    device: {
      eyebrow: "devices",
      title: "device overview",
      subtitle: "sessions appear as soon as the extension syncs.",
      primaryDevice: "primary device",
      primaryDeviceCaption: "this device",
      lastSeen: "last seen",
      lastSeenValue: "just now",
      lastSeenCaption: "when the extension checked in",
      connected: "connected"
    },
    sessions: {
      eyebrow: "sessions",
      title: "session manager",
      subtitle: "revoke access by device once sessions are available.",
      comingSoon: "coming soon",
      empty: "sessions are coming soon. connect the extension to populate this list."
    }
  },
  footer: {
    supportEmail: "support@gettrail.net",
    statusText: "status: all systems normal"
  }
} as const;

export type AccountCopy = typeof accountCopy;
