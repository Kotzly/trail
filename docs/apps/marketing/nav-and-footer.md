# Marketing: Nav and Footer

**Scope:** `apps/marketing/` — gettrail.net  
**Purpose:** Top navigation (logo, links) and footer (links, branding); shared across marketing pages.

---

## File Map

| Role | Path |
|------|------|
| Nav | `apps/marketing/app/components/MarketingNav.tsx` |
| Footer | `apps/marketing/app/components/MarketingFooter.tsx` |
| Layout | `apps/marketing/app/layout.tsx` (wraps children with nav/footer if desired) |

---

## Design Patterns

1. **Nav**  
   Typically: logo (link to `/`), links (e.g. FAQ, Support, Downloads), optional CTA. Sticky or static; responsive (e.g. mobile menu). Uses `@trail/ui` and Tailwind.

2. **Footer**  
   Links (Privacy, Terms, Support, etc.), copyright, optional social or logo. Often in a grid or row; same design tokens as rest of site.

3. **Layout**  
   Root layout may render MarketingNav + main + MarketingFooter; legal and other routes inherit.

---

## AI Agent Notes

- Link targets: ensure hrefs match routes (`/privacy`, `/terms`, `/support`, `/downloads`, `/faq`).  
- Copy: links text can live in `packages/content` marketing copy for consistency.
