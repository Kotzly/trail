import { fetchSiteSettings } from "@/lib/sanity/queries";
import { LandingNav, type NavLink } from "./landing/Nav";
import { LandingFooter } from "./landing/Footer";

const FALLBACK_LINKS: NavLink[] = [
  { label: "Features", href: "/#features" },
  { label: "Try it", href: "/#try" },
  { label: "Changelog", href: "/changelog" },
];

export async function SiteChrome({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const settings = await fetchSiteSettings(locale);
  const links: NavLink[] = settings?.nav?.length
    ? settings.nav
    : FALLBACK_LINKS;
  const ctaText = settings?.navCta?.text ?? "Add to Chrome";
  const ctaHref = settings?.navCta?.href ?? "/#cta";
  return (
    <>
      <LandingNav links={links} ctaText={ctaText} ctaHref={ctaHref} />
      <main className="flex-1 pt-20">{children}</main>
      <LandingFooter
        contactEmail={settings?.supportEmail}
        copyright={settings?.footerCopyright}
      />
    </>
  );
}
