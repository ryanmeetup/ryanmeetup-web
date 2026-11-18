"use client";

import { useEffect } from "react";
import { NotFoundCard } from "@ryanmeetup/ui";
import { FiRefreshCw, FiShoppingBag } from "react-icons/fi";

/**
 * The branded page for an unexpected failure, such as a Shopify outage or
 * timeout. Used by both the route and root-layout error boundaries.
 */
export function StoreError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // Production hides server error messages; the digest matches the server log.
  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;

  return (
    <main className="store-container grid min-h-[65vh] items-center py-12 sm:py-16 lg:py-20">
      <NotFoundCard
        code="Error"
        kicker="Something went wrong"
        tagName="Oops"
        title={<>The shelves are<br />having a moment.</>}
        description="We couldn’t load this page. It’s usually a brief hiccup on our end, so give it another go."
        primaryAction={{ label: "Try again", onClick: retry, icon: <FiRefreshCw aria-hidden /> }}
        secondaryAction={{ href: "/collections/all", label: "Shop All", icon: <FiShoppingBag aria-hidden /> }}
        helpText={
          digest ? (
            <>
              Still not working? Mention reference <code className="font-mono">{digest}</code> to
            </>
          ) : (
            "Still not working? Let"
          )
        }
        helpLink={{ href: "/contact", label: digest ? "store support" : "store support know" }}
      />
    </main>
  );
}
