import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "./metadata";

/** schema.org JSON-LD, safe to place inside a `<script>`: a `<` can't close the tag early. */
export function serializeJsonLd(data: object) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export const STORE_ID = `${SITE_URL}/#store`;
export const BRAND = { "@type": "Brand", name: "Ryan Meetup" } as const;
/** The store by name as well as by `@id`, since only the home page carries its full node. */
export const SELLER = { "@type": "OnlineStore", "@id": STORE_ID, name: SITE_NAME, url: SITE_URL } as const;

/** The parent organization, described in full on RyanMeetup.com. */
const ryanMeetup = { "@type": "Organization", name: "Ryan Meetup", url: "https://ryanmeetup.com" };

// The same profiles as the shared footer's follow links.
const sameAs = [
  "https://www.instagram.com/ryanmeetup/",
  "https://www.facebook.com/ryanmeetup/",
  "https://www.youtube.com/@ryanmeetup",
  "https://www.tiktok.com/@ryanmeetup/",
  "https://www.threads.net/@ryanmeetup",
];

/** Google reads at most this many countries in one return policy. */
const maxPolicyCountries = 50;

/**
 * All sales are final, so the return policy is "not permitted" wherever the store ships.
 * Without the country list (demo mode, or Shopify down), or with more countries than
 * Google reads, the policy is left out rather than stated for the wrong places.
 */
export function buildReturnPolicy(shippingCountries: string[]) {
  const applicableCountry = [...new Set(shippingCountries)];
  if (!applicableCountry.length || applicableCountry.length > maxPolicyCountries) return null;
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry,
    returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
    merchantReturnLink: `${SITE_URL}/policies/refund-policy`,
  } as const;
}

/** Who runs the store and what the site is called, for search results and knowledge panels. */
export function buildStoreSchema(shippingCountries: string[] = []) {
  const returnPolicy = buildReturnPolicy(shippingCountries);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "OnlineStore",
        "@id": STORE_ID,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        parentOrganization: ryanMeetup,
        brand: BRAND,
        sameAs,
        ...(returnPolicy ? { hasMerchantReturnPolicy: returnPolicy } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        publisher: { "@id": STORE_ID },
        inLanguage: "en-US",
      },
    ],
  };
}

export type BreadcrumbEntry = { name: string; path: string };

/**
 * The page's place in the catalog, by canonical path. It ignores the visible trail's
 * `from` origin, which varies by how the shopper arrived.
 */
export function buildBreadcrumbSchema(entries: BreadcrumbEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: new URL(entry.path, SITE_URL).toString(),
    })),
  };
}
