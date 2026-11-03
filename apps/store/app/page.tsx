import Link from "next/link";
import {
  Button,
  Card,
  Heading,
  Kicker,
  RotatingGallery,
  SectionHeader,
  Text,
} from "@ryanmeetup/ui";
import { FiArrowRight, FiPackage, FiShield, FiTruck } from "react-icons/fi";
import { ProductGrid } from "@/components/product-grid";
import { catalogCollections } from "@/lib/catalog-collections";
import { getHomeCatalog } from "@/lib/shopify";

export const revalidate = 300;

const heroPhotos = [
  {
    src: "/hero/ryan-merch-table.jpg",
    alt: "Ryans browsing official Ryan Meetup shirts and hats at a merch table",
    title: "The Ryan merch table",
  },
  {
    src: "/hero/ryans-game-show.jpg",
    alt: "A crowd of Ryans wearing Ryan name-tag shirts at Ryan’s Game Show",
    title: "Ryan’s Game Show",
  },
  {
    src: "/hero/ryan-baseball-classic.jpg",
    alt: "Ryans in event shirts cheering together at the Ryan Baseball Classic",
    title: "Ryan Baseball Classic",
  },
  {
    src: "/hero/rytoberfest.jpg",
    alt: "A large group of Ryans wearing Ryan shirts at Rytoberfest",
    title: "Rytoberfest",
  },
];

// Four columns at xl and two below keep the four-listing sections in full rows.
const gridColumns = "mt-8 sm:grid-cols-2 xl:grid-cols-4";

// Class names stay literal so Tailwind can see them; each steps up to its widest
// count without squeezing cards at intermediate widths.
const featuredGridColumns: Record<number, string> = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
};

// Up to five columns, choosing the count that leaves the fewest empty slots in the
// last row (widest wins a tie): five favorites sit in one row, six in two rows of three.
function getFeaturedColumns(count: number) {
  const emptySlots = (columns: number) => (columns - (count % columns)) % columns;
  let best = Math.min(Math.max(count, 1), 5);
  for (let columns = best - 1; columns >= 2; columns--) {
    if (emptySlots(columns) < emptySlots(best)) best = columns;
  }
  return best;
}

export default async function HomePage() {
  const { featured, sections, more } = await getHomeCatalog();
  return (
    <main>
      <section className="store-container py-8 sm:py-12 lg:py-16">
        <div className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-[#e9e3d6] px-5 py-8 shadow-xl sm:px-10 sm:py-12 lg:px-12 lg:py-14 xl:px-16 dark:border-white/10 dark:bg-[#151816]">
          <div
            aria-hidden
            className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_center,rgba(0,0,0,0.16)_1px,transparent_1.5px)] [background-size:18px_18px] dark:opacity-20 dark:[background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.22)_1px,transparent_1.5px)]"
          />
          <div className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-14 xl:gap-20">
            <div>
              <Kicker className="!text-black/55 dark:!text-white/60">
                Official Ryan provisions
              </Kicker>
              <Heading
                size="h1"
                className="mt-4 max-w-3xl text-5xl leading-[0.95] sm:text-6xl xl:text-7xl"
              >
                Dress like everyone knows your name.
              </Heading>
              <Text className="mt-6 max-w-xl text-lg text-black/70 sm:text-xl dark:text-white/70">
                Shirts, hats, and assorted goods for the world’s most organized
                first name—field-tested by actual Ryans.
              </Text>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button.Link
                  href="/collections/all"
                  size="lg"
                  className="!w-full sm:!w-auto"
                  rightIcon={<FiArrowRight />}
                >
                  Shop everything
                </Button.Link>
                <Button.Link
                  href="#collections"
                  size="lg"
                  variant="secondary"
                  className="!w-full sm:!w-auto"
                >
                  Browse collections
                </Button.Link>
              </div>
            </div>
            <RotatingGallery items={heroPhotos} />
          </div>
        </div>
      </section>

      <section className="store-container py-10 sm:py-14">
        <SectionHeader title={featured.collection.title} description={featured.collection.description} meta="Featured goods" />
        <ProductGrid products={featured.products} eagerCount={5} className={`mt-8 ${featuredGridColumns[getFeaturedColumns(featured.products.length)]}`} />
      </section>

      {sections.map(({ collection, products, total }) => (
        <section key={collection.id} aria-labelledby={`collection-${collection.handle}`} className="store-container py-10 sm:py-14">
          <SectionHeader
            title={<span id={`collection-${collection.handle}`}>{collection.title}</span>}
            description={collection.description || undefined}
            meta="Collection"
            actions={
              <Button.Link href={`/collections/${collection.handle}`} size="md" variant="secondary" className="!w-full sm:!w-auto" rightIcon={<FiArrowRight />}>
                {total > products.length ? `See all ${total}` : "View collection"}
              </Button.Link>
            }
          />
          <ProductGrid products={products} eagerCount={0} className={gridColumns} />
        </section>
      ))}

      {more.length > 0 && (
        <section className="store-container py-10 sm:py-14">
          <SectionHeader title="More Ryan goods" description="Everything else on the shelf." meta="Also available" />
          <ProductGrid products={more} eagerCount={0} className={gridColumns} />
        </section>
      )}

      <section id="collections" className="store-container py-12 sm:py-20">
        <SectionHeader title="Choose your department" description="There is no wrong aisle. There are only varying levels of Ryan." meta="Departments" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {catalogCollections.map((collection, index) => (
            <Link key={collection.id} href={`/collections/${collection.handle}`} className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40">
              <Card hover size="lg" className={`relative min-h-64 overflow-hidden ${index === 0 ? "!bg-nametag text-white" : "!bg-white/70 dark:!bg-white/5"}`}>
                <span className={`text-[10px] font-bold uppercase tracking-[0.25em] ${index === 0 ? "text-white/70" : "text-black/50 dark:text-white/50"}`}>Department {String(index + 1).padStart(2, "0")}</span>
                <Heading ignoreColorMode size="h3" className={`mt-14 text-3xl ${index === 0 ? "text-white" : "text-black dark:text-white"}`}>{collection.title}</Heading>
                <p className={`mt-3 text-sm leading-relaxed ${index === 0 ? "text-white/75" : "text-black/65 dark:text-white/65"}`}>{collection.description}</p>
                <FiArrowRight aria-hidden className="absolute bottom-6 right-6 text-2xl transition group-hover:translate-x-1" />
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-black/10 bg-white/45 dark:border-white/10 dark:bg-white/[0.025]">
        <div className="store-container grid gap-8 py-12 sm:grid-cols-3 sm:py-16">
          {[
            { icon: <FiPackage />, title: "Made for you", text: "Printful produces each order on demand." },
            { icon: <FiShield />, title: "Secure checkout", text: "Payment and tax are handled by Shopify." },
            { icon: <FiTruck />, title: "Tracked delivery", text: "Shipping updates arrive right in your inbox." },
          ].map((item) => (
            <div key={item.title} className="flex gap-4"><span className="mt-1 text-xl text-nametag">{item.icon}</span><div><h2 className="font-cooper text-xl tracking-wide">{item.title}</h2><Text className="mt-1 text-sm">{item.text}</Text></div></div>
          ))}
        </div>
      </section>
    </main>
  );
}
