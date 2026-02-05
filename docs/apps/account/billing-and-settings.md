# Account App: Billing and Settings

**Scope:** `apps/account/` — app.gettrail.net  
**Purpose:** Billing (plans, subscription, Stripe portal); user settings (profile, preferences).

---

## File Map

| Role | Path |
|------|------|
| Billing page | `apps/account/app/(app)/billing/page.tsx` |
| Settings page | `apps/account/app/(app)/settings/page.tsx` |
| v1 billing routes | `apps/account/app/v1/billing/route.ts`, `portal/route.ts` |
| v1 subscription | `apps/account/app/v1/subscription/route.ts`, `checkout/route.ts` |
| v1 plans | `apps/account/app/v1/plans/route.ts` |

---

## Design Patterns

1. **Billing**  
   Page lists plan/status; “Manage billing” or “Upgrade” links to Stripe Customer Portal or checkout. v1 routes may proxy to Stripe API or internal billing service; portal redirect returns user to billing page.

2. **Settings**  
   Form(s) for profile (name, email, image) and app preferences; submit to tRPC or v1 API; success toast or redirect.

3. **v1 routes**  
   REST-style routes under `/v1/` for billing (portal redirect, plans list, subscription create); may use Better Auth session or API key.

---

## AI Agent Notes

- Stripe: portal session creation requires Stripe secret; redirect URL back to app.gettrail.net/billing.  
- Plans/subscription: if using tRPC, add procedures in packages/trpc and call from billing page; otherwise v1 routes are the contract.  
- Settings: user update may go through tRPC me mutation or PATCH /v1/account; Better Auth profile update may require Better Auth API.
