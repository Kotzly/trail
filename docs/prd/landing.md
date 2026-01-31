# PRD: Landing (gettrail.net)

**Product:** Trail marketing site  
**Scope:** gettrail.net — homepage, downloads, FAQ, support, legal  
**Status:** Living doc

---

## 1. Goals & Success

- **Primary:** Convert visitors to extension installs (Chromium) or waitlist (Firefox).
- **Secondary:** Support (email, quick checks), trust (testimonials, legal), SEO (meta, structure).
- **Success:** CTA clicks to /downloads, waitlist signups, support email clicks; low bounce on key sections.

---

## 2. User Flows

### 2.1 Anonymous visitor → Extension install

1. Land on homepage (hero).
2. Read value prop (hero lead + rotating words + summary).
3. Click primary CTA **“Get the extension”** → `/downloads`.
4. On downloads: see browser-specific message (Chromium: install CTA + store link; Firefox: join waitlist).
5. Click store link (Chrome Web Store / Edge Add-ons) or submit waitlist.
6. **Alternative:** Click secondary CTA **“See the 60s demo”** → `/#showcase` (video/section); then may go to downloads.

### 2.2 Anonymous visitor → Support

1. Nav or footer: **Support** → `/support`.
2. Read subtitle and quick checks.
3. Click **“Email support”** → `mailto:support@gettrail.net` (optionally with template from “Include this in your message”).
4. Or click **“Open the FAQ”** → `/faq`; **“Extension downloads”** → `/downloads`.

### 2.3 Anonymous visitor → Legal / Trust

1. Footer: **Privacy** → `/privacy`; **Terms** → `/terms`.
2. Pages render from single markdown source; H1 splits sections.
3. No sign-in; read-only.

### 2.4 Visitor → Sign in (from marketing)

1. Nav: **“Sign in”** → `https://app.gettrail.net` (or equivalent).
2. Leaves marketing domain; auth on account app.

---

## 3. Edge Cases & Handling

| Scenario | Handling |
|----------|----------|
| **Unsupported browser (e.g. Safari)** | Downloads page: show “Join waitlist” or “Chrome/Edge recommended”; no direct install. |
| **Bot / no JS** | Server-rendered content; hero word rotator is enhancement (no keyframes → static first word). |
| **Prefers reduced motion** | Testimonials carousel: no auto-scroll; content still readable. Hero: consider disabling word animation if added. |
| **Very small viewport** | Nav may collapse to menu; sections stack; CTAs remain tappable. |
| **Slow network** | Hero and sections load in order; showcase video lazy; avoid blocking above-the-fold. |
| **Invalid or missing legal markdown** | legal-source throws if file missing; build/deploy fails. Ensure `trail_privacy_policy_terms_of_service.md` at expected path. |
| **Waitlist API failure** | POST /api/waitlist: show inline error; allow retry; do not lose email input if possible. |
| **Deep link to anchor (e.g. /#showcase)** | Scroll to section on load; id on section. |
| **Direct hit to /downloads** | No referrer from hero; still show full page with browser detection. |

---

## 4. Technical Constraints

- **Stack:** Next.js (App Router), React, Tailwind, `@trail/ui`, `@trail/content`. Vercel deployment.
- **Copy:** All strings from `packages/content` (marketing); no hardcoded marketing copy in app.
- **Legal:** Single markdown file at repo root; read at build/request; split by H1 for privacy vs terms. Do not edit generated output.
- **Analytics:** Vercel Analytics on homepage; no PII in copy.
- **SEO:** Meta title/description from content; semantic headings (h1 on hero, h2 on sections).
- **Performance:** LCP on hero; lazy-load below-fold (e.g. video, testimonials images). Avoid large client bundles above fold.
- **Accessibility:** Carousel has `role="region"`, `aria-label`; focus/hover pause. Nav/footer keyboard and screen-reader friendly.
- **Browser detection (downloads):** Server-side `User-Agent` from headers; Chromium vs Firefox vs other. No client-only detection for primary CTA.

---

## 5. Out of Scope (current)

- A/B tests on hero CTAs.
- Multi-language (en only).
- Blog or changelog on marketing domain.
- Client-side analytics events (only Vercel server/analytics as of now).
