import NextImage from "next/image";
import { Button, SectionHeader } from "@ryanmeetup/ui";
import { FaShirt } from "react-icons/fa6";

import type { MerchCollection } from "@/actions/fetchShopify";

/** A reserved merch tile shown until the Shopify collection has products. */
type MerchPlaceholder = {
  /** Unique; doubles as the React key. */
  id: string;
  title: string;
  /** The store page this tile sends people to. */
  href: string;
};

type MerchStripProps = {
  /** Null or empty until the Shopify collection exists and has stock. */
  collection: MerchCollection | null;
  /** Where "Shop the collection" goes while there is no collection yet. */
  fallbackHref: string;
  placeholders: MerchPlaceholder[];
  limit?: number;
};

const formatPrice = ({ amount, currencyCode }: { amount: string; currencyCode: string }) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: Number(amount) % 1 === 0 ? 0 : 2,
  }).format(Number(amount));

const tileLinkClasses =
  "group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/30";

const MerchStrip = ({
  collection,
  fallbackHref,
  placeholders,
  limit = 4,
}: MerchStripProps) => {
  const products = collection?.products.slice(0, limit) ?? [];
  const collectionHref = collection?.href ?? fallbackHref;

  return (
    <section id="merch" className="scroll-mt-28 space-y-6">
      <SectionHeader
        title="Suit up for the Classic"
        description="Official Baseball Classic gear, made for wearing your name to the ballpark."
        actions={
          <div className="hidden lg:block">
            <Button.Link href={collectionHref} variant="outline">
              Shop the collection
            </Button.Link>
          </div>
        }
      />
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {products.length > 0
          ? products.map((product) => (
              <li key={product.id}>
                <a href={product.href} className={tileLinkClasses}>
                  <div className="relative aspect-square overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
                    {product.image ? (
                      <NextImage
                        src={product.image.url}
                        alt={product.image.altText ?? product.title}
                        fill
                        sizes="(min-width: 1024px) 25vw, 50vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
                      />
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-black dark:text-white">{product.title}</p>
                  <p className="text-sm text-black/70 dark:text-white/70">
                    {formatPrice(product.price)}
                  </p>
                </a>
              </li>
            ))
          : placeholders.slice(0, limit).map((placeholder) => (
              <li key={placeholder.id}>
                <a href={placeholder.href} className={tileLinkClasses}>
                  <div className="flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-black/20 bg-black/[0.03] text-4xl text-black/30 transition-colors group-hover:border-black/40 dark:border-white/20 dark:bg-white/5 dark:text-white/30 dark:group-hover:border-white/40">
                    <FaShirt aria-hidden />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-black dark:text-white">
                    {placeholder.title}
                  </p>
                  <p className="text-sm text-black/70 dark:text-white/70">Coming soon</p>
                </a>
              </li>
            ))}
      </ul>
      <div className="lg:hidden">
        <Button.Link href={collectionHref} variant="outline" fullWidth className="sm:w-auto">
          Shop the collection
        </Button.Link>
      </div>
    </section>
  );
};

export { MerchStrip };
export type { MerchPlaceholder };
