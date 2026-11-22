import type { Metadata, Viewport } from "next";
import { RyanMeetupFooter, ToastHost } from "@ryanmeetup/ui";
import { ThemeProvider } from "next-themes";
import { BugReportBanner } from "@/components/bug-report-banner";
import { CartDrawer } from "@/components/cart-drawer";
import { CartProvider } from "@/components/cart-provider";
import { StoreAnalytics } from "@/components/store-analytics";
import { CurrencyProvider } from "@/components/currency-provider";
import { Header } from "@/components/header";
import { NavSectionProvider } from "@/components/nav-section";
import { PromotionBanner, PromotionProvider } from "@/components/promotion";
import { DEFAULT_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/metadata";
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

// Site-wide defaults only. Nested fields are replaced, not merged, so a canonical
// or og:url here would be inherited by every page that sets none, including the
// 404 page; the home page sets its own in app/page.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Page titles stay short in social cards; the browser tab adds the store name.
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, locale: "en_US", type: "website", images: [DEFAULT_IMAGE] },
  twitter: { card: "summary_large_image", images: [DEFAULT_IMAGE.url] },
};

// The theme is forced dark, so the browser chrome and native controls match it.
export const viewport: Viewport = { themeColor: "#171717", colorScheme: "dark" };

// The header menu is on every page, including the error pages, so a Shopify outage
// leaves the Collections menu with only Shop All instead of failing the layout.
async function getMenuCollections() {
  const collections = await getCollections().catch((error: unknown) => {
    console.error("Could not load collections for the header menu.", error);
    return [];
  });
  return collections.map(({ handle, title, description }) => ({ handle, title, description }));
}

// Apparel and Accessories list only the groupings with something in them. An outage
// lists every grouping rather than emptying both menus.
async function getMenuGarments() {
  return getStockedGarments().catch((error: unknown) => {
    console.error("Could not load garment groupings for the header menu.", error);
    return null;
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
            <StoreAnalytics />
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
