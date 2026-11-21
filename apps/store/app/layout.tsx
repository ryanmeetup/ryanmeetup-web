import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { RyanMeetupFooter, ToastHost } from "@ryanmeetup/ui";
import { ThemeProvider } from "next-themes";
import { BugReportBanner } from "@/components/bug-report-banner";
import { CartDrawer } from "@/components/cart-drawer";
import { CartProvider } from "@/components/cart-provider";
import { CurrencyProvider } from "@/components/currency-provider";
import { Header } from "@/components/header";
import { NavSectionProvider } from "@/components/nav-section";
import { buildPageMetadata, DEFAULT_IMAGE, SITE_NAME, SITE_URL } from "@/lib/metadata";
import { getCollections, getCustomerAccountUrl, getPolicies, isShopifyConfigured } from "@/lib/shopify";
import { getBugReportHref } from "@/lib/support";
import "./globals.css";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: SITE_NAME,
    description: "Official Ryan Meetup shirts, sweatshirts, hats, and assorted Ryan provisions.",
    canonical: SITE_URL,
    image: DEFAULT_IMAGE,
  }),
  // Page titles stay short in social cards; the browser tab adds the store name.
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
};

// The header menu is on every page, including the error pages, so a Shopify outage
// leaves the Collections menu with only Shop All instead of failing the layout.
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
        <ThemeProvider attribute="class" forcedTheme="dark" enableSystem={false}>
          <CartProvider commerceConfigured={commerceConfigured}>
            <CurrencyProvider>
              <NavSectionProvider>
                <BugReportBanner />
                <Header collections={collections} accountUrl={accountUrl} />
                {children}
              </NavSectionProvider>
            </CurrencyProvider>
            <RyanMeetupFooter
              homeHref="https://ryanmeetup.com"
              sections={[
                { title: "Help", links: [{ href: "/contact", label: "Customer service" }, { href: getBugReportHref(), label: "Report a bug" }] },
                ...(policyLinks.length ? [{ title: "Policies", href: "/policies", links: policyLinks }] : []),
              ]}
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
