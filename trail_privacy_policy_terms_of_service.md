# Privacy Policy

_Last updated: January 31, 2026_

## 1. Overview
Trail ("we", "our", "us") provides the Trail browser extension and related services (collectively, the "Service"). This Privacy Policy explains what information the browser tool processes, where it is stored, and when it is sent to our servers.

## 1A. Plain-language summary (non-binding)
This summary is a friendly overview and does not replace the legal text below.
We run a lightweight browser tool that records URLs, titles, and notes so you can retrace research paths.
Data stays on your device unless you sign in for optional account features.
You can delete local data at any time from the product or your browser settings.

## 2. What the App Collects

### 2.1 Browsing / navigation data (to build your "trail")
While the tool is enabled, it automatically tracks **main-frame navigation events** in your browser in order to build a navigation tree. This may include:
- Page URL (including path, query parameters, and fragments)
- Page title
- Favicon URL
- Timestamps related to navigation events
- A tree structure representing how pages are connected (parent/child navigations)

This means the tool can capture a record of the pages you visit while it is enabled (except for certain non-web schemes such as `chrome-extension:`, `devtools:`, `mailto:`, etc.).

### 2.2 App settings
The product stores your preferences (e.g., UI and capacity settings).

### 2.3 Account / subscription data (only if you use those features)
If you use account, authentication, or billing features from the product UI, the product may:
- Store authentication tokens locally
- Request account/subscription status from our backend

## 3. Permissions and How Collection Works
The software requests broad website access (host permission **`<all_urls>`**) and uses Chrome APIs (including `webNavigation`, `tabs`, and a content script) so it can:
- Detect navigations and build/update your navigation tree
- Observe title and favicon changes on pages

The product does **not** intentionally collect:
- Keystrokes or form input values
- Passwords
- The contents of web pages (beyond the URL/title/favicon described above)

## 4. Where Your Data Is Stored

### 4.1 Local storage (on your device)
By default, your navigation tree data is stored locally in the browser using **`chrome.storage.local`** (local storage). This can include:
- `trail_tree` (your current navigation tree)
- `trail_tree_meta` (tree metadata such as label and timestamps)
- `trail_tree_archives` (archived trees)
- `trail_settings` (product settings)
- `trail_auth_session` (only if you sign in; authentication session/token data)

### 4.2 Backend storage (only for account/subscription features)
If you use account/subscription features, the product communicates with our backend at **`https://app.gettrail.net`** to authenticate and retrieve account/subscription/billing-related information.

## 5. What We Send to Our Backend
- **Navigation/trail data:** The product is designed to keep your navigation tree data **local to your browser** and does not send your navigation tree to our backend by default.
- **Account/subscription requests (optional):** If you use account/subscription features, the product will send requests needed to provide those features (for example: auth portal session requests, account snapshot, subscription/billing status). These requests may include authentication tokens when applicable.

## 6. Data Sharing
We do not sell your data.

We may share information only:
- With service providers strictly necessary to operate the account/subscription backend (if you use those features)
- If required by law or valid legal process
- To protect the rights, safety, and integrity of Trail

## 6A. Practical sharing note (non-binding)
This section is a simple overview and does not replace the legal text below.
Sharing is optional and happens only when you invite someone or export.
You can keep work local, and you can delete it from the product at any time.

## 7. Retention
- **Local navigation/tree data:** Stored in `chrome.storage.local` until you delete it from the product, clear local site data/storage, or uninstall the add-on. Depending on your settings (e.g., capacity limits), older nodes may be evicted automatically.
- **Local auth session data:** Stored until you log out or clear local storage/uninstall.
- **Backend account/subscription data:** Retained as needed to operate your account (if any) and to meet legal, billing, and security requirements.

## 8. Incognito / Private Browsing
The add-on does not run in Incognito by default. If you explicitly enable the add-on for Incognito in your browser settings, it will be able to track navigations in Incognito windows as well.

## 9. Security
We use reasonable safeguards appropriate to the type of data processed. No system is 100% secure.

## 10. Contact
For privacy questions or requests, contact: **support@gettrail.net**

## 11. Your Choices
You can control or remove local data by deleting trees from the product UI, clearing local storage/site data, disabling the add-on, or uninstalling it.

## 12. Children’s Privacy
The Service is not intended for children under the age of 13, and we do not knowingly collect personal information from children.

## 13. Changes to This Policy
We may update this Privacy Policy from time to time. Changes will be posted with an updated “Last updated” date.

---

# Terms of Service

_Last updated: January 31, 2026_

## 1. Acceptance of Terms
By accessing or using Trail, you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the product.

## 1A. Plain-language summary (non-binding)
This summary is a friendly overview and does not replace the legal text below.
The product helps you save research paths and notes across sessions.
You are responsible for your account and agree not to misuse the product.
Paid plans bill as described at checkout, and you can cancel anytime.

## 2. Description of the product
Trail is a browser tool that automatically builds a navigation tree based on your browsing activity while the tool is enabled. The product may also include optional account and subscription features.

## 2A. Plain-language scope (non-binding)
This section is a general overview and does not replace the legal text below.
The product is built to help you capture links and notes in a timeline-like view.
It is not a replacement for your existing recordkeeping, and you should still save critical work in your own systems.

## 3. User Responsibilities
You agree that you will:
- Use Trail in compliance with applicable laws
- Not misuse Trail for illegal, harmful, or abusive purposes
- Not attempt to reverse engineer, disrupt, or exploit the product

## 4. User Content
You retain ownership of content you create using Trail (including the organization/labels you apply to your navigation trees).

You grant Trail a limited, non-exclusive license to store and process your content solely to provide Trail.

## 5. Intellectual Property
The product, including its design, code, and branding, is owned by Trail and protected by intellectual property laws.

You may not copy, modify, or distribute any part of the Service without prior written permission.

## 6. Subscription and Payments
Some features may require a paid subscription.
- Prices and billing terms will be disclosed before purchase
- Subscriptions may renew automatically unless canceled

## 6A. Plain-language billing overview (non-binding)
This section is a simple overview and does not replace the legal text below.
Paid plans are billed monthly or annually as shown at checkout.
You can switch plans or cancel from the account area.

## 7. Termination
We may suspend or terminate your access if you violate these Terms.

You may stop using Trail at any time.

## 8. Disclaimer of Warranties
Trail is provided "as is" and "as available" without warranties of any kind.

## 9. Limitation of Liability
To the maximum extent permitted by law, Trail shall not be liable for indirect, incidental, or consequential damages.

## 10. Governing Law
These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Trail operates.

## 11. Changes to Terms
We may update these Terms from time to time. Continued use of Trail after changes constitutes acceptance.

## 12. Contact
For questions about these Terms, contact: **support@gettrail.net**
