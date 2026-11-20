import NextImage from "next/image";
import { Button, Heading, Kicker, Text } from "@ryanmeetup/ui";

import type { BaseballTeam } from "@/lib/types";
import { getSeasonStats, getTeamLogoSrc } from "@/utils/baseball";

type BaseballHeroProps = {
  teams: BaseballTeam[];
  /** Computed from announced game dates; null until a team is announced. */
  seasonRange: string | null;
  hasMerch: boolean;
};

type Point = [number, number];
type Seam = [Point, Point, Point, Point];

// Two baseball seams curving in from the hero's edges, as cubic Béziers in
// the SVG's 1200×480 space.
const SEAMS: Seam[] = [
  [
    [70, -40],
    [310, 120],
    [310, 360],
    [70, 520],
  ],
  [
    [1130, -40],
    [890, 120],
    [890, 360],
    [1130, 520],
  ],
];
const STITCHES_PER_SEAM = 26;
const STITCH_GAP = 4; // from the seam line to where a stitch starts
const STITCH_REACH = 12; // how far a stitch reaches out from the seam
const STITCH_LEAN = 7; // how far it leans along the seam, forming the V

const seamPath = ([p0, p1, p2, p3]: Seam) => `M ${p0} C ${p1}, ${p2}, ${p3}`;

/** Point and unit tangent at `t` on a cubic Bézier. */
const pointOnSeam = ([p0, p1, p2, p3]: Seam, t: number) => {
  const u = 1 - t;
  const at = (i: 0 | 1) =>
    u ** 3 * p0[i] +
    3 * u ** 2 * t * p1[i] +
    3 * u * t ** 2 * p2[i] +
    t ** 3 * p3[i];
  const slope = (i: 0 | 1) =>
    3 * u ** 2 * (p1[i] - p0[i]) +
    6 * u * t * (p2[i] - p1[i]) +
    3 * t ** 2 * (p3[i] - p2[i]);
  const [dx, dy] = [slope(0), slope(1)];
  const length = Math.hypot(dx, dy) || 1;
  return { x: at(0), y: at(1), tx: dx / length, ty: dy / length };
};

/** The red V-shaped stitches either side of a seam, as one path. */
const stitchPath = (seam: Seam) =>
  Array.from({ length: STITCHES_PER_SEAM }, (_, index) => {
    const { x, y, tx, ty } = pointOnSeam(
      seam,
      (index + 0.5) / STITCHES_PER_SEAM,
    );
    // Normal to the seam; one stitch on each side, both leaning forward.
    const [nx, ny] = [-ty, tx];
    return [1, -1]
      .map((side) => {
        const start = [x + nx * STITCH_GAP * side, y + ny * STITCH_GAP * side];
        const end = [
          x + nx * STITCH_REACH * side + tx * STITCH_LEAN,
          y + ny * STITCH_REACH * side + ty * STITCH_LEAN,
        ];
        return `M ${start.map((n) => n.toFixed(1))} L ${end.map((n) => n.toFixed(1))}`;
      })
      .join(" ");
  }).join(" ");

const BaseballSeams = () => (
  <svg
    aria-hidden
    viewBox="0 0 1200 480"
    preserveAspectRatio="xMidYMid slice"
    className="pointer-events-none absolute inset-0 hidden h-full w-full text-nametag opacity-30 sm:block dark:opacity-40"
  >
    {SEAMS.map((seam) => (
      <g
        key={seamPath(seam)}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
      >
        <path d={seamPath(seam)} strokeWidth="1.5" opacity="0.5" />
        <path d={stitchPath(seam)} strokeWidth="3" />
      </g>
    ))}
  </svg>
);

// Below this many logos the loop repeats so visibly it looks broken.
const MIN_STRIP_LOGOS = 3;
// Enough logos in one run to overfill a wide screen before it repeats.
const STRIP_RUN_LENGTH = 16;
const STRIP_SECONDS_PER_LOGO = 3;

/**
 * Every announced team's logo drifting past. Decorative: the same teams are
 * listed, with names, in the finder below, so the strip is hidden from
 * assistive tech and simply stops for readers who prefer reduced motion.
 */
const TeamLogoStrip = ({ teams }: { teams: BaseballTeam[] }) => {
  const logos = teams.flatMap((team) => {
    const src = getTeamLogoSrc(team);
    return src ? [{ slug: team.slug, src }] : [];
  });
  if (logos.length < MIN_STRIP_LOGOS) return null;

  const rounds = Math.ceil(STRIP_RUN_LENGTH / logos.length);
  const run = Array.from({ length: rounds }, (_, round) =>
    logos.map((logo) => ({ ...logo, key: `${round}-${logo.slug}` })),
  ).flat();

  return (
    <div
      aria-hidden
      className="relative -mx-6 -mb-6 overflow-hidden border-t border-black/10 py-4 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] lg:-mx-10 lg:-mb-10 dark:border-white/10"
    >
      <ul
        className="flex w-max animate-marquee motion-reduce:animate-none"
        style={{ animationDuration: `${run.length * STRIP_SECONDS_PER_LOGO}s` }}
      >
        {/* Two identical runs back to back make the -50% loop seamless. */}
        {["a", "b"].flatMap((copy) =>
          run.map((logo) => (
            <li key={`${copy}-${logo.key}`} className="px-2 sm:px-3">
              <div className="relative size-12 overflow-hidden rounded-xl border border-black/10 bg-white sm:size-14 dark:border-white/10">
                <NextImage
                  src={logo.src}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-contain p-1.5"
                />
              </div>
            </li>
          )),
        )}
      </ul>
    </div>
  );
};

const BaseballHero = ({ teams, seasonRange, hasMerch }: BaseballHeroProps) => {
  const stats = getSeasonStats(teams);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-white/80 p-6 text-center shadow-drop dark:border-white/10 dark:bg-white/5 lg:p-10">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.08),_transparent_60%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_60%)]"
      />
      <BaseballSeams />
      <div className="relative flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-4">
          {seasonRange && <Kicker>{seasonRange}</Kicker>}
          <Heading
            className="title text-balance text-4xl sm:text-5xl lg:text-6xl"
            size="h1"
          >
            The Ryan Baseball Classic
          </Heading>
          <Text className="max-w-3xl text-lg text-black/70 dark:text-white/70">
            Ryans are taking over the ballpark. No Bryans in the bleachers.
          </Text>
        </div>

        {stats.teams > 0 && (
          <dl className="flex flex-wrap justify-center gap-x-10 gap-y-4">
            {[
              {
                label: stats.teams === 1 ? "Team" : "Teams",
                value: stats.teams,
              },
              {
                label: stats.states === 1 ? "State" : "States",
                value: stats.states,
              },
              {
                label: stats.gameNights === 1 ? "Game night" : "Game nights",
                value: stats.gameNights,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col-reverse items-center gap-1"
              >
                <dt className="text-xs font-semibold uppercase tracking-caps text-black/70 dark:text-white/70">
                  {stat.label}
                </dt>
                <dd className="font-cooper text-3xl leading-none text-black dark:text-white">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

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

        <TeamLogoStrip teams={teams} />
      </div>
    </section>
  );
};

export { BaseballHero };
