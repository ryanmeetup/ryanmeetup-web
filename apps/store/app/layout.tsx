import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Banner, RyanMeetupFooter, ToastHost } from "@ryanmeetup/ui";
import { ThemeProvider } from "next-themes";
import { CartDrawer } from "@/components/cart-drawer";
import { CartProvider } from "@/components/cart-provider";
import { CurrencyProvider } from "@/components/currency-provider";
import { Header } from "@/components/header";
import { NavSectionProvider } from "@/components/nav-section";
import { buildPageMetadata, DEFAULT_IMAGE, SITE_NAME, SITE_URL } from "@/lib/metadata";
import { getCollections, getCustomerAccountUrl, getPolicies, isShopifyConfigured } from "@/lib/shopify";
import "./globals.css";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: SITE_NAME,
    description: "Official Ryan Meetup shirts, sweatshirts, hats, and assorted Ryan provisions.",
    canonical: SITE_URL,
    image: DEFAULT_IMAGE,
    // Beta: keep search engines from listing the test store.
    robots: { index: false, follow: false },
  }),
  // Page titles stay short in social cards; the browser tab adds the store name.
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
};

// The header menu is on every page, including the error pages, so a Shopify outage
// leaves the Collections menu with only Shop all instead of failing the layout.
async function getMenuCollections() {
  const collections = await getCollections().catch((error: unknown) => {
    console.error("Could not load collections for the header menu.", error);
    return [];
  });
  return collections.map(({ handle, title, description }) => ({ handle, title, description }));
}

// Only the policies written in Shopify Admin get a footer link.
async function getPolicyLinks() {
  const policies = await getPolicies().catch((error: unknown) => {
    console.error("Could not load policies for the footer.", error);
    return [];
  });
  return policies.map(({ handle, title }) => ({ href: `/policies/${handle}`, label: title }));
}

// The header's Your orders link; a Shopify outage just leaves it out.
async function getHeaderAccountUrl() {
  return getCustomerAccountUrl().catch((error: unknown) => {
    console.error("Could not load the customer account link.", error);
    return null;
  });
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const commerceConfigured = isShopifyConfigured();
  const [collections, policyLinks, accountUrl] = await Promise.all([getMenuCollections(), getPolicyLinks(), getHeaderAccountUrl()]);
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <CartProvider commerceConfigured={commerceConfigured}>
            {/* Remove before launch, along with the noindex robots metadata above. */}
            <Banner
              role="region"
              aria-label="Beta notice"
              mobileInline
              className="!border-b-4 !border-black !bg-[#ffcc00] !text-black"
              contentClassName="store-container !justify-center"
              icon={<span className="rounded-md bg-black px-2.5 py-1 font-cooper text-base tracking-[0.2em] text-[#ffcc00] sm:text-lg">BETA</span>}
            >
              <span className="font-semibold">
                This store is a test drive, not the real thing yet. Please don&apos;t place real orders.
                {!commerceConfigured && " Shopify isn't connected, so checkout is off."}
              </span>
            </Banner>
            <CurrencyProvider>
              <NavSectionProvider>
                <Header collections={collections} accountUrl={accountUrl} />
                {children}
              </NavSectionProvider>
            </CurrencyProvider>
            <RyanMeetupFooter
              homeHref="https://ryanmeetup.com"
              sections={policyLinks.length ? [{ title: "Policies", links: policyLinks }] : []}
              followColumn={false}
              className="store-container"
            />
            <CartDrawer />
            <ToastHost />
            <Analytics />
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
