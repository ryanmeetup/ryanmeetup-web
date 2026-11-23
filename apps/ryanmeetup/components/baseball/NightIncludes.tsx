import type { CSSProperties, ReactNode } from "react";
import { SectionHeader, Text } from "@ryanmeetup/ui";
import { FiGift, FiStar, FiTag, FiUsers } from "react-icons/fi";

const INCLUDES: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <FiUsers aria-hidden />,
    title: "Ryan rows",
    text: "Dedicated seating for Ryans (and Ryan family/friends)",
  },
  {
    icon: <FiStar aria-hidden />,
    title: "On the field",
    text: "An exclusive Ryan experience on the field",
  },
  {
    icon: <FiTag aria-hidden />,
    title: "Name tags",
    text: "Official Ryan Meetup nametags",
  },
  {
    icon: <FiGift aria-hidden />,
    title: "Nine innings",
    text: "9 innings of Ryan fun and surprises",
  },
];

// Where the stub tears off: the height of the stub, and so the centre of the
// punched notches on either edge.
const TEAR_LINE = "5rem";
const NOTCH = "0.75rem";

// Two real cut-outs (not painted circles), so the notches show whatever sits
// behind the ticket in either theme.
const notchMask = [
  `radial-gradient(circle at 0 ${TEAR_LINE}, transparent ${NOTCH}, #000 calc(${NOTCH} + 0.5px))`,
  `radial-gradient(circle at 100% ${TEAR_LINE}, transparent ${NOTCH}, #000 calc(${NOTCH} + 0.5px))`,
].join(", ");

const ticketStyle: CSSProperties = {
  maskImage: notchMask,
  WebkitMaskImage: notchMask,
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
};

/** What every official Classic night comes with, whichever ballpark it's at. */
const NightIncludes = () => (
  <section className="space-y-6">
    <SectionHeader title="Every Ryan Baseball Classic night includes..." />
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {INCLUDES.map((item, index) => (
        <li
          key={item.title}
          className="flex transition-transform duration-300 motion-safe:even:hover:rotate-1 motion-safe:odd:hover:-rotate-1"
        >
          <article
            style={ticketStyle}
            className="flex w-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/5"
          >
            {/* The stub: admission number, torn off at the tear line. */}
            <div
              className="flex items-center px-6"
              style={{ height: TEAR_LINE }}
            >
              <div className="flex flex-col">
                <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-caps text-black/70 dark:text-white/70">
                  Admit one Ryan
                </span>
                <span
                  aria-hidden
                  className="font-cooper text-3xl leading-none text-nametag"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
            </div>
            <div
              aria-hidden
              className="mx-4 border-t-2 border-dashed border-black/15 dark:border-white/15"
            />
            <div className="flex flex-1 flex-col gap-1 px-6 pb-6 pt-4">
              <h3 className="flex items-center gap-2 font-cooper text-xl text-black dark:text-white">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-nametag text-base text-white shadow-sm">
                  {item.icon}
                </span>
                {item.title}
              </h3>
              <Text className="text-black/70 dark:text-white/70">{item.text}</Text>
            </div>
          </article>
        </li>
      ))}
    </ul>
  </section>
);

export { NightIncludes };
