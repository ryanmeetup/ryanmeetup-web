import {
  Button,
  Heading,
  Kicker,
  RotatingGallery,
  SectionHeader,
  Text,
} from "@ryanmeetup/ui";
import { FiArrowRight, FiPackage, FiShield, FiTruck } from "react-icons/fi";
import { ProductGrid } from "@/components/product-grid";
import { collectionHeading } from "@/lib/catalog-collections";
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

// Four columns at xl and two below keep the four-listing sections and eight favorites
// in full rows.
const gridColumns = "mt-8 sm:grid-cols-2 xl:grid-cols-4";

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

      <section id="collections" className="store-container py-10 sm:py-14">
        <SectionHeader title={collectionHeading(featured.collection.title)} description={featured.collection.description} meta="Featured goods" />
        <ProductGrid products={featured.products} className={gridColumns} />
      </section>

      {sections.map(({ collection, products, total }) => (
        <section key={collection.id} aria-labelledby={`collection-${collection.handle}`} className="store-container py-10 sm:py-14">
          <SectionHeader
            title={<span id={`collection-${collection.handle}`}>{collectionHeading(collection.title)}</span>}
            description={collection.description || undefined}
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
