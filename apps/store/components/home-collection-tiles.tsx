import Image from "next/image";
import Link from "next/link";
import { Card } from "@ryanmeetup/ui";
import { FiArrowRight } from "react-icons/fi";
import { getStoreCollectionIcon } from "@/lib/navigation";
import type { HomeCollectionTile } from "@/lib/shopify";

// Widths match the list's gap (0.75rem, then 1.25rem from sm): halves from mobile, then
// thirds, then quarters once there are enough tiles to fill them. A short last row is
// centred rather than left ragged.
const halves = "w-[calc((100%-0.75rem)/2)] sm:w-[calc((100%-1.25rem)/2)]";

function tileWidth(count: number) {
  if (count === 1) return "w-full sm:w-[calc((100%-1.25rem)/2)]";
  if (count === 2) return halves;
  const thirds = `${halves} lg:w-[calc((100%-2.5rem)/3)]`;
  return count === 3 ? thirds : `${thirds} xl:w-[calc((100%-3.75rem)/4)]`;
}

/** Doorways into each collection rather than its products, so the home page stays a front door. */
export function HomeCollectionTiles({ tiles }: { tiles: HomeCollectionTile[] }) {
  const width = tileWidth(tiles.length);
  return (
    <ul className="flex flex-wrap justify-center gap-3 sm:gap-5">
      {tiles.map(({ collection, image, total }) => (
        <li key={collection.id} className={width}>
          <Card size="none" hover className="h-full overflow-hidden bg-white/65 dark:bg-white/5">
            <Link
              href={`/collections/${collection.handle}`}
              className="group flex h-full flex-col rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/40 dark:focus-visible:ring-white/40"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-black/5 dark:bg-white/5">
                {image ? (
                  <Image
                    src={image.url}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    className="object-contain transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                ) : (
                  <div aria-hidden className="grid h-full place-items-center text-5xl text-black/15 dark:text-white/15">{getStoreCollectionIcon(collection.handle)}</div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3 sm:p-5">
                <h3 className="flex items-center gap-2 font-cooper text-base sm:text-xl leading-tight tracking-wide text-black dark:text-white">
                  <span className="text-base text-nametag">{getStoreCollectionIcon(collection.handle)}</span>
                  {collection.title}
                </h3>
                {collection.description && <p className="hidden text-sm sm:block text-black/70 dark:text-white/70">{collection.description}</p>}
                <span className="mt-auto inline-flex items-center gap-2 pt-2 text-xs font-semibold uppercase tracking-caps-tight text-black/70 group-hover:text-black dark:text-white/70 dark:group-hover:text-white">
                  {total} item{total === 1 ? "" : "s"}
                  <FiArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </span>
              </div>
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}
