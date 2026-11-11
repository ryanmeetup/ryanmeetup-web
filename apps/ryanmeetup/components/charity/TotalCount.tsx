"use client";

import { useMemo } from "react";

// Components
import { Heading, Text } from "@ryanmeetup/ui";

// Types
import type { Charity } from "@/lib/types";

// Utilities
import useCounter from "@/hooks/useCounter";
import { formatEventDate } from "@/utils/date";

type TotalCountProps = {
  donations: Charity[];
};

const TotalCount = (props: TotalCountProps) => {
  const { donations } = props;

  const fmt = (n: number) =>
    n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  const total = useMemo(() => {
    return donations.reduce((sum, item) => {
      const num = parseFloat(item.amount.replace(/[^0-9.-]+/g, ""));
      return sum + num;
    }, 0);
  }, [donations]);

  const animatedGrand = useCounter(total, { duration: 500 });

  return (
    <div className="px-6 text-center max-w-7xl mx-auto">
      <Heading
        className="mb-6 text-center text-4xl xl:text-7xl title"
        size="h1"
      >
        Ryan Meetup <span className="hidden xl:inline-block">has raised</span>
      </Heading>
      <div className="inline-flex items-center justify-center rounded-2xl bg-white/80 ring-1 ring-black/10 px-6 py-4 md:p-8 dark:bg-white/5 dark:ring-white/10">
        <div className="text-left">
          <div className="block xl:hidden text-lg xl:text-xl uppercase tracking-widest text-black/70 mb-4 text-center dark:text-white/80">
            HAS RAISED
          </div>
          <div className="mt-2 text-6xl md:text-[10rem] font-black text-center leading-none text-black/90 dark:text-white">
            {fmt(animatedGrand)}
          </div>
          <div className="text-lg xl:text-xl uppercase tracking-widest text-black/70 mt-4 xl:mt-10 text-center dark:text-white/80">
            FOR CHARITABLE CAUSES WORLDWIDE
          </div>
        </div>
      </div>
      <Text className="mt-4 text-sm text-black/70 dark:text-white/70">
        Last updated: {formatEventDate(new Date())}
      </Text>
    </div>
  );
};

export { TotalCount };
