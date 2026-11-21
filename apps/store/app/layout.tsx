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
import { PromotionBanner, PromotionProvider } from "@/components/promotion";
import { buildPageMetadata, DEFAULT_IMAGE, SITE_NAME, SITE_URL } from "@/lib/metadata";
import type { GarmentTable } from "@/lib/garments";
import { getCollections, getCustomerAccountUrl, getPolicies, getStockedGarments, isShopifyConfigured } from "@/lib/shopify";
import { currentPromotion, isPromotionLive } from "@/lib/promotion";
import { getBugReportHref } from "@/lib/support";
import "./globals.css";

const builtWith = [
  { href: "https://vercel.com", label: "Vercel" },
  { href: "https://nextjs.org/", label: "Next.js" },
  { href: "https://react.dev/", label: "React" },
  { href: "https://www.typescriptlang.org/", label: "TypeScript" },
  { href: "https://tailwindcss.com/", label: "Tailwind CSS" },
  { href: "https://headlessui.com/", label: "Headless UI" },
  { href: "https://www.shopify.com/", label: "Shopify" },
  { href: "https://supabase.com/", label: "Supabase" },
  { href: "https://playwright.dev/", label: "Playwright" },
];

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

// Apparel and Accessories list only the Shopify groupings with something in them. Like
// the Collections menu, an outage leaves each with only its Shop All link.
async function getMenuGarments(): Promise<GarmentTable> {
  return getStockedGarments().catch((error: unknown) => {
    console.error("Could not load garment groupings for the header menu.", error);
    return {};
  });
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

// The sale banner's first render follows the server's clock, so it is in the HTML rather
// than popping in. A server component renders once per request, so reading the time here
// is deliberate; the client re-checks its own clock after hydration.
function isPromotionLiveNow() {
  return isPromotionLive(currentPromotion, Date.now());
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const commerceConfigured = isShopifyConfigured();
  const [collections, garments, policyLinks, accountUrl] = await Promise.all([getMenuCollections(), getMenuGarments(), getPolicyLinks(), getHeaderAccountUrl()]);
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="antialiased">
        <ThemeProvider attribute="class" forcedTheme="dark" enableSystem={false}>
          <CartProvider commerceConfigured={commerceConfigured}>
            <PromotionProvider live={isPromotionLiveNow()}>
              <CurrencyProvider>
                <NavSectionProvider>
                  <PromotionBanner />
                  <BugReportBanner />
                  <Header collections={collections} garments={garments} accountUrl={accountUrl} />
                  {children}
                </NavSectionProvider>
                <RyanMeetupFooter
                  homeHref="https://ryanmeetup.com"
                  sections={[
                    { title: "Help", links: [{ href: "/contact", label: "Customer service" }, { href: getBugReportHref(), label: "Report a bug" }] },
                    ...(policyLinks.length ? [{ title: "Policies", href: "/policies", links: policyLinks }] : []),
                  ]}
                  followColumn={false}
                  builtWith={builtWith}
                  className="store-container"
                />
                {/* Inside the currency provider so the cart can explain converted estimates. */}
                <CartDrawer />
              </CurrencyProvider>
            </PromotionProvider>
            <ToastHost />
            <Analytics />
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
