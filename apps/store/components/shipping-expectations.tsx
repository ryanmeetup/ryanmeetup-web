import Link from "next/link";
import type { IconType } from "react-icons";
import { FiArrowRight, FiGlobe, FiMail, FiPackage } from "react-icons/fi";
import type { ShippingExpectation } from "@/lib/product-guidance";

const icons: Record<ShippingExpectation["id"], IconType> = { production: FiPackage, countries: FiGlobe, tracking: FiMail };

/**
 * What happens after checkout, said once below the first shelf: made to order, where it ships,
 * and how tracking arrives. Phones keep each item to one short paragraph. The shipping details
 * link sits under the item about where it ships (or the last item if that one is absent).
 */
export function ShippingExpectations({ items, className }: { items: ShippingExpectation[]; className?: string }) {
  const linkId = items.some(({ id }) => id === "countries") ? "countries" : items.at(-1)?.id;
  return (
    <ul
      className={`grid gap-3 rounded-2xl border border-black/10 bg-white/65 p-4 sm:gap-4 sm:p-5 dark:border-white/10 dark:bg-white/5 ${items.length === 2 ? "lg:grid-cols-2" : ""} ${items.length > 2 ? "lg:grid-cols-3" : ""} ${className ?? ""}`}
    >
      {items.map(({ id, title, detail }) => {
        const Icon = icons[id];
        return (
          <li key={id} className="flex min-w-0 items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nametag/10 text-nametag dark:bg-nametag/20">
              <Icon aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col items-start gap-2">
              <p className="text-sm text-black/70 sm:text-base dark:text-white/70">
                <span className="font-semibold text-black dark:text-white">{title}</span>
                <span className="sm:hidden">: </span>
                <span className="sm:block">{detail}</span>
              </p>
              {id === linkId ? (
                <Link
                  href="/policies/shipping-policy"
                  className="inline-flex items-center gap-1 rounded-sm text-sm font-semibold underline decoration-black/30 underline-offset-4 transition hover:decoration-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:decoration-white/30 dark:hover:decoration-white dark:focus-visible:ring-white/40"
                >
                  Shipping details
                  <FiArrowRight aria-hidden />
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
