import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all routes except:
  // - Next internals (`_next`, `_vercel`)
  // - Public files with extensions (`.js`, `.png`, `robots.txt`, `sitemap.xml`)
  // - API routes (`/api/*`)
  // - Public shared-trail viewer (`/s/*`) — lives outside the locale
  //   tree so share URLs stay short and locale-agnostic.
  // - Auth surfaces (`/auth/*`) — password-reset page is the only
  //   remaining one. Outside the locale tree so the email link doesn't
  //   carry a locale prefix.
  matcher: [
    "/((?!api|_next|_vercel|robots.txt|sitemap.xml|s/|auth/|.*\\..*).*)",
  ],
};
