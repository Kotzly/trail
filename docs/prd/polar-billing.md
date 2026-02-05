# PRD: Billing + Subscriptions via Polar (checkout, portal, entitlements)

**Product:** Trail account app + API
**Scope:** app.gettrail.net billing + API subscription state; replaces Stripe v1 billing routes
**Status:** Draft (needs Ivan sign-off)

---

## 0. Ivan decisions (v0)

- Billing provider: **Polar** (Merchant of Record).
- Integration target: **Next.js** (account app) + API app for webhook handling and persistent subscription state.
- Access model: **subscription tier → entitlements (benefits)**.
- First plan set: `Free` + `Pro` (names TBD), single-seat.

---

## 1. Goals & Success

### 1.1 Goals

- Users can upgrade/downgrade/cancel Trail subscriptions via Polar checkout and customer portal.
- Trail has a reliable, server-truth subscription state for feature gating (account app + API + extension).
- Polar webhooks are processed idempotently; subscription changes reflect in Trail within minutes.
- Polar “Automated Benefits” are configured so customers see what they get (and optional automation like downloads/discord/github if we add later).

### 1.2 Success metrics

- >95% successful checkout completion (no dead redirects / auth issues).
- Subscription state in Trail updates within **< 2 minutes** after checkout/renewal/cancel.
- No double-granting (idempotency) and no accidental access after cancellation.

---

## 2. Existing context to reuse

- Billing UI lives at `apps/account/app/(app)/billing/page.tsx`.
- Existing v1 Stripe-style routes (to be migrated):
  - `apps/account/app/v1/billing/route.ts`, `portal/route.ts`
  - `apps/account/app/v1/subscription/route.ts`, `checkout/route.ts`
  - `apps/account/app/v1/plans/route.ts`
- Auth: account app uses Better Auth; API app upserts user.
- Extension access is JWT-based from `apps/account/src/server/extension-auth.ts`.

Implication: Polar customer identity must map to the Better Auth user (and Trail user id) deterministically.

---

## 3. Key concepts (Polar)

Polar calls user-facing entitlements **Benefits** (a.k.a. automated benefits). Benefits are standalone resources that can be attached to one or more products/tiers. Access rules (from Polar docs): active subscribers/customers get benefits; cancelled/expired do not.

Ref: https://polar.sh/docs/features/benefits/introduction

Trail will primarily use **Custom Benefit** initially (customer-visible note / instructions).

---

## 4. Data model (Trail)

### 4.1 Required persisted subscription state

We need a minimal, queryable representation of a customer’s current access:

- `userId` (Trail user)
- `polarCustomerId`
- `polarSubscriptionId` (nullable for one-time purchases)
- `plan` / `tier` (enum: FREE, PRO, …)
- `status` (active, trialing, past_due, canceled, unpaid — map from Polar)
- `currentPeriodEnd` (for grace decisions)
- `updatedAt`

### 4.2 Idempotency tracking

Webhook processor stores processed event ids (or delivery ids) to ensure exactly-once semantics.

---

## 5. User flows

### 5.1 View billing status

1. User opens `/billing`.
2. Server loads Trail subscription state (from API app).
3. UI shows current plan, renewal date (if applicable), and CTA.

CTA rules:
- If `FREE`: show **Upgrade** (opens Polar checkout)
- If `PRO` active: show **Manage billing** (opens Polar customer portal)

### 5.2 Upgrade (checkout)

1. User clicks **Upgrade**.
2. Account app creates a Polar checkout session/link for the `PRO` product/tier.
3. User completes payment on Polar-hosted checkout.
4. Redirect back to `POLAR_SUCCESS_URL` (Trail billing success page).
5. Billing page polls API until subscription state becomes active (or shows “processing”).

Polar docs: checkout integration via Next.js adapter shown in Polar UI (screenshot Ivan sent). Exact API contract to confirm during implementation.

### 5.3 Manage billing (customer portal)

1. User clicks **Manage billing**.
2. Account app creates a portal session (server-side) and redirects user to Polar customer portal.
3. User cancels, updates payment method, upgrades/downgrades if allowed.
4. User returns to `/billing`.
5. Webhooks update Trail subscription state.

### 5.4 Cancellation & access rules

- If user cancels, access remains until end of paid period (default), unless Polar marks access revoked immediately.
- Trail gating uses:
  - `status=active` OR (`status=canceled` AND `currentPeriodEnd > now`) depending on the policy we choose.

Decision needed: strict (active only) vs grace (until period end). Default recommendation: **grace until period end**.

### 5.5 One-time purchases (optional)

If Trail later sells lifetime features or add-ons as one-time products, Polar benefits can grant lifetime access. Not in v0 unless Ivan asks.

---

## 6. Benefits configuration (what to create in Polar)

Minimum v0 benefits (customer-visible):

- **Custom Benefit: “Trail Pro Access”**
  - Note: support link, how to enable Pro, what’s included.

Optional later:
- File Downloads (for desktop builds)
- Discord access
- GitHub repo access
- License keys

Ref (custom): https://polar.sh/docs/features/benefits/custom

---

## 7. Technical constraints

- **Secrets:** Polar access token + webhook secret must live server-side (Node runtime).
- **Auth mapping:** Polar customer must be linked to Trail user (Better Auth subject). Use metadata where supported; otherwise store mapping on first purchase.
- **Webhooks:** must be verified and idempotent; handle retries.
- **Multi-app:** checkout/portal creation can live in account app, but canonical subscription state should live in API app.

---

## 8. Edge cases & handling

| Scenario | Handling |
|---|---|
| User completes checkout but redirect fails | Webhook still updates; billing page shows “processing” and recovers on refresh |
| Webhook arrives before user record exists | Upsert user on webhook (or queue + retry) |
| Duplicate webhook delivery | Idempotency store prevents double processing |
| User cancels then re-subscribes | Update subscription id/status, keep history if we store it |
| Subscription past_due / unpaid | Apply restricted access; UI prompts “Manage billing” |
| Refund / chargeback | Revoke access according to Polar event + policy |
| Multiple subscriptions per customer | Out of scope v0 (assume 0/1 active subscription) |

---

## 9. Out of scope (v0)

- Seat-based pricing.
- Usage-based billing / credits.
- In-app invoices.
- Multi-product bundles and add-ons.
- Migrating existing Stripe customers (unless Ivan says we have any).
