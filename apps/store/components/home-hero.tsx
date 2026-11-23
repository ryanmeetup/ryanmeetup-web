import { Button, Heading, Text } from "@ryanmeetup/ui";
import Image from "next/image";
import { FiArrowRight } from "react-icons/fi";
import { HomeMarquee } from "@/components/home-marquee";
import { PhotoWall } from "@/components/photo-wall";
import type { WallTile } from "@/components/photo-wall";

// Desktop is a six-column, two-row wall: a big landscape takes half, the portrait tile stands
// full height beside it, and three smaller landscapes fill the rest. Phones keep the first four
// tiles in two columns with the big one across the top. Each tile cycles through its own
// photos, so a new photo only needs adding to the tile whose shape it suits.
const WALL: WallTile[] = [
  {
    className: "col-span-2 md:col-span-3 md:row-span-2",
    sizes: "(min-width: 768px) 50vw, 100vw",
    photos: [
      { src: "/hero/ryan-merch-booth.jpg", alt: "Ryan Meetup shirts hanging above a merch table, with a volunteer in a Ryan’s Father tee", objectPosition: "35% 50%" },
      { src: "/hero/ryans-game-show.jpg", alt: "A packed theater of Ryans cheering behind a hand-painted Ryans Game Show banner" },
      { src: "/hero/ryan-baseball-classic.jpg", alt: "Ryans in Twins jerseys and Ryan Baseball Classic tees cheering in the stands, holding Let’s go Ryan signs" },
    ],
  },
  {
    className: "row-span-2",
    sizes: "(min-width: 768px) 17vw, 50vw",
    photos: [
      { src: "/hero/ryan-name-tag-tee.jpg", alt: "A Ryan in sunglasses and a Ryans beanie, wearing a white tee with a Hello my name is Ryan name tag", objectPosition: "50% 40%" },
      { src: "/hero/ryan-super-tee.jpg", alt: "A Ryan tearing open a dress shirt to reveal a superhero-style R logo tee", objectPosition: "50% 40%" },
    ],
  },
  {
    className: "md:col-span-2",
    sizes: "(min-width: 768px) 33vw, 50vw",
    photos: [
      { src: "/hero/ryan-hammock-crewneck.jpg", alt: "A Ryan in red heart sunglasses lounging in a hammock in a Ryan Meetup crewneck, phone in one hand and cash in the other", objectPosition: "65% 50%" },
      { src: "/hero/rytoberfest.jpg", alt: "A crowd of Ryans raising beers under a Welcome to the Ryan Meetup sign at Rytoberfest" },
    ],
  },
  {
    className: "",
    sizes: "(min-width: 768px) 17vw, 50vw",
    photos: [
      { src: "/hero/ryan-philadelphia-tee.jpg", alt: "A Ryan in mirrored sunglasses showing off an It’s Always Ryan in Philadelphia tee" },
      { src: "/hero/ryan-merch-table.jpg", alt: "A volunteer in a Ryan’s Father tee unpacking a shirt for a shopper at the merch table" },
    ],
  },
  {
    className: "hidden md:block",
    sizes: "17vw",
    photos: [
      { src: "/hero/ryan-family-merch-table.jpg", alt: "Three volunteers in Ryan’s Mother, Ryan’s Sister, and Ryan’s Father tees behind a table of Ryan Meetup shirts and hats" },
    ],
  },
];

/**
 * The home page opener: community photos edge to edge, the name tag and headline set large
 * over a dark fade on wider screens (below the wall on phones), and the marquee underneath.
 */
export function HomeHero() {
  return (
    <section data-analytics-placement="home_hero" data-analytics-section="home_hero" aria-label="Ryan Meetup merch" className="relative">
      <PhotoWall
        tiles={WALL}
        className="grid grid-cols-2 grid-rows-[48vw_36vw_36vw] gap-1 bg-black md:grid-cols-6 md:grid-rows-[repeat(2,clamp(11rem,21vw,20rem))]"
      >
        {/* The fade sits under the copy: from the bottom while the buttons sit bottom right, then
            from the bottom-left corner once they stack under the copy, so the right tiles stay bright. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden md:block md:bg-gradient-to-t md:from-black/90 md:via-black/50 md:via-35% md:to-transparent md:to-70% xl:bg-[radial-gradient(ellipse_75%_130%_at_0%_100%,rgb(0_0_0/0.92),rgb(0_0_0/0.72)_45%,rgb(0_0_0/0.3)_70%,transparent_90%)]"
        />
        <div className="bg-black md:absolute md:inset-x-0 md:bottom-0 md:bg-transparent">
          <div className="store-container flex flex-col gap-5 py-6 sm:py-8 md:flex-row md:items-end md:justify-between md:gap-8 lg:py-10 xl:flex-col xl:items-start xl:gap-6">
            <div className="min-w-0">
              <Image
                src="/hero/ryan-name-tag.png"
                alt=""
                width={2264}
                height={1442}
                sizes="(min-width: 1536px) 144px, (min-width: 1280px) 112px, (min-width: 768px) 96px, 80px"
                className="pointer-events-none mb-4 ml-1 h-auto w-20 -rotate-6 select-none drop-shadow-lg sm:mb-5 md:w-24 xl:w-28 2xl:w-36"
              />
              <Heading
                size="h1"
                ignoreColorMode
                className="max-w-[11ch] text-[clamp(2.5rem,11vw,3.75rem)] leading-[0.95] text-white [text-shadow:0_2px_30px_rgb(0_0_0/0.4)] md:text-6xl 2xl:text-7xl"
              >
                Merch with your name on it.
              </Heading>
              <Text className="mt-3 max-w-md text-balance text-base !text-white/85 sm:mt-4 sm:text-lg">
                Shirts, hats, and everyday goods for the world’s most organized first name.
              </Text>
            </div>
            {/* Phones stack the pair at full width, with the link centred under the button. */}
            <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Button.Link
                href="/collections/all"
                size="lg"
                className="!w-full sm:!w-auto"
                rightIcon={<FiArrowRight aria-hidden />}
              >
                Shop all merch
              </Button.Link>
              <Button.Link href="#collections" size="lg" variant="link" className="!w-full sm:!w-auto">
                Browse collections
              </Button.Link>
            </div>
          </div>
        </div>
      </PhotoWall>
      <HomeMarquee />
    </section>
  );
}
