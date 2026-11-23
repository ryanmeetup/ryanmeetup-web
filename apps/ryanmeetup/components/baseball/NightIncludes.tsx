import type { ReactNode } from "react";
import { Card, IconBadge, SectionHeader, Text } from "@ryanmeetup/ui";
import { FiGift, FiStar, FiTag, FiUsers } from "react-icons/fi";

const INCLUDES: { icon: ReactNode; text: string }[] = [
  {
    icon: <FiUsers aria-hidden />,
    text: "Dedicated seating for Ryans (and Ryan family/friends)",
  },
  { icon: <FiStar aria-hidden />, text: "An exclusive Ryan experience on the field" },
  { icon: <FiTag aria-hidden />, text: "Official Ryan Meetup nametags" },
  { icon: <FiGift aria-hidden />, text: "9 innings of Ryan fun and surprises" },
];

/** What every official Classic night comes with, whichever ballpark it's at. */
const NightIncludes = () => (
  <section className="space-y-6">
    <SectionHeader title="Every Ryan Baseball Classic night includes" />
    <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      {INCLUDES.map((item) => (
        <li key={item.text} className="flex">
          <Card className="flex w-full items-center gap-4">
            <IconBadge>{item.icon}</IconBadge>
            <Text className="text-black dark:text-white">{item.text}</Text>
          </Card>
        </li>
      ))}
    </ul>
  </section>
);

export { NightIncludes };
