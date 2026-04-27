import { fetchSiteSettings } from "@/lib/sanity/queries";
import { Header } from "./Header";
import { Footer } from "./Footer";

export async function SiteChrome({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const settings = await fetchSiteSettings(locale);
  return (
    <>
      <Header
        navLinks={settings?.nav}
        ctaText={settings?.navCta?.text}
        ctaHref={settings?.navCta?.href}
      />
      <main className="flex-1">{children}</main>
      <Footer
        links={settings?.footerLinks}
        copyright={settings?.footerCopyright}
      />
    </>
  );
}
