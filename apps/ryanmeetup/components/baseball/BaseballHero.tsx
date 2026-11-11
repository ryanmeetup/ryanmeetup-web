import { Button, Heading, Kicker, Text } from "@ryanmeetup/ui";

type BaseballHeroProps = {
  /** Computed from announced game dates; null until a team is announced. */
  seasonRange: string | null;
  hasMerch: boolean;
};

// PLACEHOLDER COPY: swap the subheadline and details for the real Classic
// copy before launch. Nothing here states a fact that isn't in Contentful.
const BaseballHero = ({ seasonRange, hasMerch }: BaseballHeroProps) => (
  <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-white/80 p-6 text-center shadow-drop dark:border-white/10 dark:bg-white/5 lg:p-10">
    <div
      aria-hidden
      className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.08),_transparent_60%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_60%)]"
    />
    <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-4">
      {seasonRange && <Kicker>{seasonRange}</Kicker>}
      <Heading className="text-4xl title sm:text-5xl lg:text-6xl" size="h1">
        The Ryan Baseball Classic
      </Heading>
      <Text className="text-lg text-black/70 dark:text-white/70">
        Ryans are taking over the ballpark. Find the Ryan night nearest you,
        grab tickets, and show up dressed for the occasion. No Bryans in the
        bleachers.
      </Text>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button.Link href="#find" size="md" fullWidth className="sm:w-auto">
          Find your game
        </Button.Link>
        {hasMerch && (
          <Button.Link
            href="#merch"
            size="md"
            variant="outline"
            fullWidth
            className="sm:w-auto"
          >
            Shop the merch
          </Button.Link>
        )}
      </div>
    </div>
  </section>
);

export { BaseballHero };
