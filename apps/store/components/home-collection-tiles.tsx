import Image from "next/image";
import { FiArrowRight } from "react-icons/fi";
import { getStoreCollectionIcon } from "@/lib/navigation";
import { MediaCard } from "./media-card";
import { MerchGrid } from "./merch-grid";
import type { HomeCollectionTile } from "@/lib/shopify";
import { getCollectionPath } from "@/lib/catalog-collections";

/** Doorways into each collection rather than its products, so the home page stays a front door. */
// Shares the best sellers' even-row grid on the home page.
export function HomeCollectionTiles({ tiles, className }: { tiles: HomeCollectionTile[]; className?: string }) {
  return (
    <MerchGrid
      evenRows
      className={className}
      items={tiles.map(({ collection, image, total }) => ({
        key: collection.id,
        card: (
          <MediaCard
            href={getCollectionPath(collection.handle)}
            media={image ? (
              <Image src={image.url} alt="" fill sizes="(max-width: 1024px) 50vw, 33vw" className="object-contain" />
            ) : (
              <div aria-hidden className="grid h-full place-items-center text-5xl text-black/15 dark:text-white/15">{getStoreCollectionIcon(collection.handle)}</div>
            )}
            title={<><span aria-hidden className="text-base text-nametag">{getStoreCollectionIcon(collection.handle)}</span>{collection.title}</>}
          >
            {collection.description && <p className="hidden text-sm text-black/70 sm:block dark:text-white/70">{collection.description}</p>}
            <span className="mt-auto inline-flex items-center gap-2 pt-2 text-xs font-semibold uppercase tracking-caps-tight text-black/70 group-hover:text-black dark:text-white/70 dark:group-hover:text-white">
              {total} item{total === 1 ? "" : "s"}
              <FiArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </span>
          </MediaCard>
        ),
      }))}
    />
  );
}
