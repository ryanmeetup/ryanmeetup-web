import NextImage from "next/image";
import {
  Button,
  DropdownMenu,
  DropdownMenuButton,
  DropdownMenuItemLink,
  DropdownMenuItems,
  Heading,
  Kicker,
  Text,
  getButtonClasses,
} from "@ryanmeetup/ui";
import { FiArrowUpRight, FiChevronDown } from "react-icons/fi";

import type { BaseballTeam } from "@/lib/types";
import { getSeasonStats } from "@/utils/baseball";

type BaseballHeroProps = {
  teams: BaseballTeam[];
  /** Computed from announced game dates; null until a team is announced. */
  seasonRange: string | null;
  /** The map only renders once a team is announced. */
  hasMap: boolean;
};

// Albums from earlier installments, copied from their Contentful `gallery`
// entries (also listed on /gallery). Oldest first; the menu lists newest first.
const PAST_ALBUMS = [
  {
    year: 2025,
    title: "Ryans @ Rockies",
    href: "https://photos.app.goo.gl/rTSW8pzCw6TgczcC9",
  },
  {
    year: 2026,
    title: "Ryan Baseball Classic",
    href: "https://photos.app.goo.gl/e91wbBpxYyCcaudV9",
  },
];

// The official Ryan Baseball Classic logo. Until the artwork lands this stays
// null and larger screens show a dashed placeholder where it will sit. To
// swap it in, drop the file in public/baseball/ and fill in its real pixel size;
// the logo then stands in for the visible title (which stays as its alt text).
type ClassicLogo = { src: string; width: number; height: number };
// Cast so TypeScript doesn't narrow to `null` and flag the logo branch.
const CLASSIC_LOGO = null as ClassicLogo | null;

const CLASSIC_TITLE = "The Ryan Baseball Classic";

// Ryan's Google Form for national anthem singer auditions.
const ANTHEM_SINGER_FORM_URL = "https://forms.gle/1i7iNp52M7Dfzp966";

const ClassicLogoPlaceholder = () => (
  <div
    aria-hidden
    className="hidden aspect-[2/1] w-64 items-center justify-center rounded-2xl border-2 border-dashed border-black/20 bg-black/[0.03] text-xs font-semibold uppercase tracking-caps text-black/70 sm:flex dark:border-white/20 dark:bg-white/5 dark:text-white/70"
  >
    Official logo
  </div>
);

type Point = [number, number];
type Seam = [Point, Point, Point, Point];

// One seam bowing in from the hero's left edge, as a cubic Bézier in a
// fixed-width 96×480 strip. The right edge is the same strip mirrored, so the
// seams hug the sides at every width instead of scaling into the title.
const SEAM: Seam = [
  [-40, -40],
  [80, 120],
  [80, 360],
  [-40, 520],
];
const STITCHES_PER_SEAM = 24;
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

const SeamEdge = ({ side }: { side: "left" | "right" }) => (
  <svg
    aria-hidden
    viewBox="0 0 96 480"
    preserveAspectRatio="xMinYMid slice"
    className={`pointer-events-none absolute inset-y-0 hidden h-full w-24 text-nametag opacity-30 sm:block dark:opacity-40 ${side === "left" ? "left-0" : "right-0 -scale-x-100"}`}
  >
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      <path d={seamPath(SEAM)} strokeWidth="1.5" opacity="0.5" />
      <path d={stitchPath(SEAM)} strokeWidth="3" />
    </g>
  </svg>
);

const BaseballHero = ({
  teams,
  seasonRange,
  hasMap,
}: BaseballHeroProps) => {
  const stats = getSeasonStats(teams);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-white/80 p-6 text-center shadow-drop dark:border-white/10 dark:bg-white/5 lg:p-10">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.08),_transparent_60%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_60%)]"
      />
      <SeamEdge side="left" />
      <SeamEdge side="right" />
      <div className="relative flex flex-col items-center gap-4 sm:gap-6">
        <div className="flex flex-col items-center gap-4">
          {!CLASSIC_LOGO && <ClassicLogoPlaceholder />}
          {seasonRange && <Kicker>{seasonRange}</Kicker>}
          {CLASSIC_LOGO ? (
            <h1>
              <NextImage
                src={CLASSIC_LOGO.src}
                width={CLASSIC_LOGO.width}
                height={CLASSIC_LOGO.height}
                alt={CLASSIC_TITLE}
                priority
                sizes="(min-width: 1024px) 28rem, (min-width: 640px) 24rem, 18rem"
                className="h-auto w-72 sm:w-96 lg:w-[28rem]"
              />
            </h1>
          ) : (
            <Heading
              className="title text-balance text-4xl sm:text-5xl lg:text-6xl"
              size="h1"
            >
              {CLASSIC_TITLE}
            </Heading>
          )}
          <Text className="max-w-3xl text-balance text-base text-black/70 sm:text-lg dark:text-white/70">
            Find the official Ryan Baseball Classic night nearest you and get
            tickets today. No Bryans in the bleachers.
          </Text>
        </div>

        {stats.teams > 0 && (
          <dl className="flex flex-wrap justify-center gap-x-6 gap-y-3 sm:gap-x-10 sm:gap-y-4">
            {[
              {
                label: stats.teams === 1 ? "Team" : "Teams",
                value: stats.teams,
              },
              {
                label: stats.states === 1 ? "State" : "States",
                value: stats.states,
              },
              // Only worth saying once the Classic crosses a border.
              ...(stats.countries > 1
                ? [{ label: "Countries", value: stats.countries }]
                : []),
              {
                label: stats.nights === 1 ? "Night" : "Nights",
                value: stats.nights,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col-reverse items-center gap-1"
              >
                <dt className="text-xs font-semibold uppercase tracking-caps text-black/70 dark:text-white/70">
                  {stat.label}
                </dt>
                <dd className="font-cooper text-2xl leading-none text-black sm:text-3xl dark:text-white">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
          <Button.Link href="#find" size="md" fullWidth className="sm:w-auto">
            Find your game
          </Button.Link>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-center">
            {hasMap && (
              <Button.Link
                href="#map"
                size="sm"
                variant="secondary"
                fullWidth
                className="min-h-11 sm:w-auto"
              >
                See the map
              </Button.Link>
            )}
            <Button.Link
              href={ANTHEM_SINGER_FORM_URL}
              newTab
              size="sm"
              variant="secondary"
              fullWidth
              className="min-h-11 sm:w-auto"
            >
              Sing the anthem
              <span className="sr-only"> (opens in a new tab)</span>
            </Button.Link>
            <Button.Link
              href="#merch"
              size="sm"
              variant="secondary"
              fullWidth
              className="min-h-11 sm:w-auto"
            >
              Shop the merch
            </Button.Link>
            {/* One trigger for every past album, so the row doesn't grow a
                button each year. Menu renders no wrapper, so the trigger stays
                a direct child of this row. */}
            <DropdownMenu>
              <DropdownMenuButton
                unstyled
                className={`${getButtonClasses("secondary", "sm", true)} min-h-11 px-3! sm:w-auto sm:px-4!`}
              >
                <span>Photo albums</span>
                <span className="text-base">
                  <FiChevronDown aria-hidden />
                </span>
              </DropdownMenuButton>
              <DropdownMenuItems align="end" aria-label="Past photo albums">
                {[...PAST_ALBUMS].reverse().map((album) => (
                  <DropdownMenuItemLink
                    key={album.href}
                    href={album.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="flex flex-1 flex-col">
                      <span className="font-semibold">{album.year}</span>
                      <span className="text-xs text-black/70 dark:text-white/70">
                        {album.title}
                      </span>
                    </span>
                    <FiArrowUpRight aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </DropdownMenuItemLink>
                ))}
              </DropdownMenuItems>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </section>
  );
};

export { BaseballHero };
