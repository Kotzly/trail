const SITE_URL = "https://gettrail.net";
const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/trail/joimfhgkjgkgjibahiocoolkbejmckmb";

const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Trail",
  url: SITE_URL,
  description:
    "Capture sources, notes, and decisions as you browse. Trail turns tab chaos into organized research trails you can share without storing page content.",
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Trail",
  url: SITE_URL,
  applicationCategory: "BrowserApplication",
  operatingSystem: "Chrome, Edge, Brave, Arc",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  installUrl: CHROME_STORE_URL,
  description:
    "Browser extension that captures your browsing into visual research trails you can annotate and share.",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Trail",
  url: SITE_URL,
  logo: `${SITE_URL}/assets/brand/trail-fork-light.svg`,
  contactPoint: {
    "@type": "ContactPoint",
    email: "support@gettrail.net",
    contactType: "customer support",
  },
};

const schemas = [webSiteSchema, softwareAppSchema, organizationSchema];

export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }}
    />
  );
}
