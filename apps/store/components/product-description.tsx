/** @jsxImportSource react */
import { DisclosureCard } from "@ryanmeetup/ui";
import { splitProductDescription } from "@/lib/product-description";
import type { Product } from "@/lib/types";

export function ProductDescription({ description, descriptionHtml, part }: Pick<Product, "description" | "descriptionHtml"> & { part?: "intro" | "details" }) {
  const content = splitProductDescription({ description, descriptionHtml });

  function renderContent(value: string, className = "product-description") {
    return content.html ? (
      // Rich HTML is authored in Shopify Admin and supplied by the Storefront API.
      <div className={className} dangerouslySetInnerHTML={{ __html: value }} />
    ) : <p className={`${className} whitespace-pre-line`}>{value}</p>;
  }

  return (
    <>
      {part !== "details" && content.intro && <div className="mt-6">{renderContent(content.intro, "product-description product-description-lead")}</div>}
      {part !== "intro" && content.details && (
        <DisclosureCard
          summary="Product details"
          className="border-b border-black/10 dark:border-white/10"
          buttonClassName="flex w-full items-center justify-between gap-4 rounded-sm py-5 text-left font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40"
          panelClassName="pb-5"
        >
          {renderContent(content.details)}
        </DisclosureCard>
      )}
    </>
  );
}
