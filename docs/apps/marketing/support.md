# Marketing: Support Page

**Scope:** `apps/marketing/` — gettrail.net  
**Purpose:** Support hub: email CTA, quick checks, FAQ teaser, feature request template; copy from content package.

---

## File Map

| Role | Path |
|------|------|
| Page | `apps/marketing/app/support/page.tsx` |
| Flow / layout | `apps/marketing/app/support/SupportFlow.tsx` |
| Copy | `packages/content/src/marketing/en.ts` (marketingCopy.support) |

---

## Copy Shape (support)

```ts
support: {
  meta: { title, description };
  eyebrow: string;
  title: string;
  subtitle: string;
  email: string;
  actions: { email, featureRequest, faq, downloads, signIn, signInHref };
  featureRequest: { title, subtitle, includeTitle, include: string[] };
  includeTitle: string;
  include: string[];       // checklist for support email
  quickChecksTitle: string;
  quickChecks: string[];
  faqTitle: string;
  faqNote: string;
  faqCta: string;
}
```

---

## Design Patterns

1. **Email CTA**  
   Primary action: mailto or copy email; secondary: feature request (e.g. mailto with template), FAQ link, downloads, sign-in.

2. **Quick checks**  
   Bullet list (e.g. refresh, extension enabled, incognito); copy from support.quickChecks.

3. **Feature request**  
   Section with title/subtitle and template bullets (support.featureRequest.include); “Include this in your message” checklist (support.include) for general support.

4. **FAQ teaser**  
   Short list or link to full FAQ (support.faqCta → /faq).

---

## AI Agent Notes

- Add new action: add key to support.actions and render link/button in SupportFlow.  
- Localization: all strings in packages/content; support page consumes marketingCopy.support.
