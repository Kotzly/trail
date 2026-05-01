import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all routes except Next internals, public files, api routes, and
  // SEO/sitemap endpoints that must stay locale-neutral.
  matcher: ["/((?!api|_next|_vercel|robots.txt|sitemap.xml|.*\\..*).*)"],
};
