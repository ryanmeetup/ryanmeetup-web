import { Button, Heading, Text } from "@ryanmeetup/ui";
import Image from "next/image";
import { FiArrowRight } from "react-icons/fi";
import { HomeMarquee } from "@/components/home-marquee";

type WallPhoto = {
  src: string;
  alt: string;
  objectPosition?: string;
  /** Grid placement for the tile, phone first. */
  className: string;
  sizes: string;
};

// Desktop is a six-column, two-row wall: the booth photo takes half, the portrait tee stands
// full height beside it, and three smaller shots fill the rest. Phones keep four tiles in two
// columns with the booth photo across the top.
const WALL: WallPhoto[] = [
  {
    src: "/hero/ryan-merch-booth.jpg",
    alt: "Ryan Meetup shirts hanging above a merch table, with a volunteer in a Ryan’s Father tee",
    objectPosition: "35% 50%",
    className: "col-span-2 md:col-span-3 md:row-span-2",
    sizes: "(min-width: 768px) 50vw, 100vw",
  },
  {
    src: "/hero/ryan-super-tee.jpg",
    alt: "A Ryan tearing open a dress shirt to reveal a superhero-style R logo tee",
    objectPosition: "50% 40%",
    className: "row-span-2",
    sizes: "(min-width: 768px) 17vw, 50vw",
  },
  {
    src: "/hero/ryan-hammock-crewneck.jpg",
    alt: "A Ryan in red heart sunglasses lounging in a hammock in a Ryan Meetup crewneck, phone in one hand and cash in the other",
    objectPosition: "65% 50%",
    className: "md:col-span-2",
    sizes: "(min-width: 768px) 33vw, 50vw",
  },
  {
    src: "/hero/ryan-philadelphia-tee.jpg",
    alt: "A Ryan in mirrored sunglasses showing off an It’s Always Ryan in Philadelphia tee",
    className: "",
    sizes: "(min-width: 768px) 17vw, 50vw",
  },
  {
    src: "/hero/ryan-family-merch-table.jpg",
    alt: "Three volunteers in Ryan’s Mother, Ryan’s Sister, and Ryan’s Father tees behind a table of Ryan Meetup shirts and hats",
    className: "hidden md:block",
    sizes: "17vw",
  },
];

/**
 * The home page opener: community photos edge to edge, the headline set large over a dark
 * fade on wider screens (below the wall on phones), and the marquee bands underneath.
 */
export function HomeHero({ facts }: { facts: string[] }) {
  return (
    <section data-analytics-placement="home_hero" data-analytics-section="home_hero" aria-label="Ryan Meetup merch" className="relative">
      <div className="relative">
        <div className="grid grid-cols-2 grid-rows-[48vw_36vw_36vw] gap-1 bg-black md:grid-cols-6 md:grid-rows-[repeat(2,clamp(11rem,21vw,20rem))]">
          {WALL.map(({ src, alt, objectPosition, className, sizes }, index) => (
            <div key={src} className={`relative overflow-hidden ${className}`}>
              <Image
                src={src}
                alt={alt}
                fill
                sizes={sizes}
                preload={index === 0}
                className="object-cover"
                style={objectPosition ? { objectPosition } : undefined}
              />
            </div>
          ))}
        </div>
        <div className="bg-black md:absolute md:inset-x-0 md:bottom-0 md:bg-transparent md:bg-gradient-to-t md:from-black/90 md:via-black/60 md:to-transparent md:pt-32">
          <div className="store-container flex flex-col gap-5 py-6 sm:py-8 md:flex-row md:items-end md:justify-between md:gap-8 lg:py-10">
            <div className="min-w-0">
              <Heading
                size="h1"
                ignoreColorMode
                className="max-w-[11ch] text-[clamp(2.5rem,11vw,3.75rem)] leading-[0.95] text-white [text-shadow:0_2px_30px_rgb(0_0_0/0.4)] md:text-6xl xl:text-7xl 2xl:text-8xl"
              >
                Merch with your name on it.
              </Heading>
              <Text className="mt-3 max-w-md text-base !text-white/85 sm:mt-4 sm:text-lg">
                Shirts, hats, and everyday goods for the world’s most organized first name.
              </Text>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Button.Link
                href="/collections/all"
                size="lg"
                className="!w-full sm:!w-auto"
                rightIcon={<FiArrowRight aria-hidden />}
              >
                Shop all merch
              </Button.Link>
              <Button.Link href="#collections" size="lg" variant="link">
                Browse collections
              </Button.Link>
            </div>
          </div>
        </div>
      </div>
      <HomeMarquee facts={facts} />
    </section>
  );
}
