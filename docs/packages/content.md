# Packages: Content (Copy)

**Scope:** `packages/content/`  
**Purpose:** Centralized copy strings (English) for marketing and account apps; single source for labels, hero, testimonials, support, etc.

---

## File Map

| Role | Path |
|------|------|
| Index | `packages/content/src/index.ts` |
| Marketing copy | `packages/content/src/marketing/en.ts` |
| Account copy | `packages/content/src/account/en.ts` |

---

## Interfaces

### Export

- `marketingCopy` — object with meta, nav, support, hero, stats, testimonials, faq, etc.  
- `accountCopy` (or similar) — object for account app strings.  
- Index re-exports both; apps import `import { marketingCopy } from '@trail/content'`.

### marketingCopy shape (partial)

- **meta:** title, description.  
- **nav:** features, workflow, faq, support, signIn, getStarted.  
- **support:** meta, eyebrow, title, subtitle, email, actions, featureRequest, includeTitle, include, quickChecksTitle, quickChecks, faqTitle, faqNote, faqCta.  
- **hero:** pill, lead, words[], summary, ctaPrimary, ctaSecondary.  
- **testimonials:** array of { name, role, quote, image }.  
- **stats:** array for landing stats.  
- **faq:** structure for FAQ page.

---

## Design Patterns

1. **Single locale**  
   English only; files named en.ts; no i18n layer in package.

2. **Structured by feature**  
   Top-level keys = app area (nav, hero, support); nested for sections.

3. **Assets**  
   Image paths in copy (e.g. testimonials[].image) are relative to app public (e.g. /assets/people/…).

---

## AI Agent Notes

- Add string: add to appropriate key in marketing/en.ts or account/en.ts; consume in component.  
- New section: add new key (e.g. pricing) and document shape; use in corresponding page.
