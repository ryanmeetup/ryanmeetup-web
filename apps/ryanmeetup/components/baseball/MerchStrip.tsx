import NextImage from "next/image";
import { Button, SectionHeader } from "@ryanmeetup/ui";

import type { MerchCollection } from "@/actions/fetchShopify";

type MerchStripProps = {
  collection: MerchCollection;
  limit?: number;
};

const formatPrice = ({ amount, currencyCode }: { amount: string; currencyCode: string }) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: Number(amount) % 1 === 0 ? 0 : 2,
  }).format(Number(amount));

const MerchStrip = ({ collection, limit = 4 }: MerchStripProps) => {
  const products = collection.products.slice(0, limit);

  return (
    <section id="merch" className="scroll-mt-28 space-y-6">
      <SectionHeader
        title="Suit up for the Classic"
        description="Official Baseball Classic gear, made for wearing your name to the ballpark."
        actions={
          <div className="hidden lg:block">
            <Button.Link href={collection.href} variant="outline">
              Shop the collection
            </Button.Link>
          </div>
        }
      />
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.id}>
            <a
              href={product.href}
              className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/30"
            >
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
        ))}
      </ul>
      <div className="lg:hidden">
        <Button.Link href={collection.href} variant="outline" fullWidth className="sm:w-auto">
          Shop the collection
        </Button.Link>
      </div>
    </section>
  );
};

export { MerchStrip };
