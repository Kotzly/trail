type JsonLdProps = {
  siteName?: string;
  siteUrl?: string;
  description?: string;
  supportEmail?: string;
  installUrl?: string;
};

const FALLBACK_URL = "https://gettrail.net";

export function JsonLd({
  siteName,
  siteUrl,
  description,
  supportEmail,
  installUrl,
}: JsonLdProps) {
  const name = siteName ?? "Trail";
  const url = siteUrl ?? FALLBACK_URL;
  const desc =
    description ??
    "Capture sources, notes, and decisions as you browse. Trail turns tab chaos into organized research trails you can share without storing page content.";

  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name,
      url,
      description: desc,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name,
      url,
      applicationCategory: "BrowserApplication",
      operatingSystem: "Chrome, Edge, Brave, Arc, Firefox, Zen",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      ...(installUrl ? { installUrl } : {}),
      description: desc,
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name,
      url,
      logo: `${url}/assets/brand/trail-fork-light.svg`,
      ...(supportEmail
        ? {
            contactPoint: {
              "@type": "ContactPoint",
              email: supportEmail,
              contactType: "customer support",
            },
          }
        : {}),
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schemas).replace(/</g, "\\u003c"),
      }}
    />
  );
}
