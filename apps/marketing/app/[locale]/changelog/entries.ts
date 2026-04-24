export type ChangelogChangeType = "added" | "changed" | "fixed" | "removed";

export type ChangelogChange = {
  type: ChangelogChangeType;
  description: string;
};

export type ChangelogEntry = {
  version: string;
  date: string;
  title?: string;
  changes: ChangelogChange[];
};

export const changelog: ChangelogEntry[] = [
  {
    version: "0.3.0",
    date: "2026-04-15",
    title: "Faster sync, fewer surprises",
    changes: [
      {
        type: "added",
        description: "Instant sync between the browser extension and web app.",
      },
      {
        type: "changed",
        description:
          "Subscription math and usage limits now update in real time.",
      },
      {
        type: "fixed",
        description:
          "Auth session no longer drops after restarting the browser.",
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-03-28",
    title: "Safer by default",
    changes: [
      {
        type: "added",
        description:
          "Row-level security across all user data on hosted Supabase.",
      },
      {
        type: "added",
        description: "CSRF protection on cookie-based logout.",
      },
      {
        type: "changed",
        description:
          "Consolidated authentication into a single bearer-token resolver.",
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-03-10",
    title: "Public preview",
    changes: [
      {
        type: "added",
        description: "Trail launches as an invite-only public preview.",
      },
    ],
  },
];
