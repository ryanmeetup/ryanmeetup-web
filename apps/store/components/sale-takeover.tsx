"use client";

import { Button, Heading, Kicker, Text } from "@ryanmeetup/ui";
import Image from "next/image";
import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { FiArrowRight } from "react-icons/fi";
import { PhotoWall } from "@/components/photo-wall";
import type { WallTile } from "@/components/photo-wall";
import { usePromotion } from "@/components/promotion";
import { describeTierScope } from "@/lib/promotion";
import type { Promotion } from "@/lib/promotion";

/**
 * The home hero while a takeover sale runs, and the regular hero (`children`) otherwise. The
 * running sale comes from the shared promotion clock, so the takeover appears and leaves on
 * the sale's own start and end times without a deploy.
 */
export function SaleTakeoverSwitch({ tiles, children }: { tiles: WallTile[]; children: ReactNode }) {
  const promotion = usePromotion();
  if (!promotion?.takeover) return children;
  return <SaleTakeover promotion={promotion} tiles={tiles} />;
}

function SaleTakeover({ promotion, tiles }: { promotion: Promotion; tiles: WallTile[] }) {
  return (
    <div className="grid bg-black md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="relative overflow-hidden">
        <Image
          src="/hero/ryan-merch-booth.jpg"
          alt=""
          fill
          sizes="(min-width: 768px) 56vw, 100vw"
          className="object-cover opacity-20 grayscale contrast-125"
        />
        <div className="store-container relative flex flex-col items-start gap-5 py-8 sm:gap-6 sm:py-10 md:!pr-8 lg:py-12 lg:!pr-12">
          <Image
            src="/hero/ryan-name-tag.png"
            alt=""
            width={2264}
            height={1442}
            sizes="(min-width: 1280px) 112px, (min-width: 768px) 96px, 80px"
            className="pointer-events-none ml-1 h-auto w-20 -rotate-6 select-none drop-shadow-lg md:w-24 xl:w-28"
          />
          <div>
            <Kicker className="!text-nametag">Sale ends {promotion.endsLabel}</Kicker>
            <Heading
              size="h1"
              ignoreColorMode
              className="mt-2 text-[clamp(3rem,15vw,4.5rem)] leading-[0.86] text-white md:text-7xl xl:text-8xl"
            >
              <SaleName promotion={promotion} />
            </Heading>
          </div>
          <ul className="flex flex-wrap gap-3" aria-label={`${promotion.name} discounts`}>
            {promotion.tiers.map((tier, index) => {
              const top = index === promotion.tiers.length - 1;
              return (
                <li
                  key={tier.minQuantity}
                  // A price tag, with a hole punched near the rounded end.
                  className={`relative flex items-baseline gap-2 rounded-l-lg rounded-r-[1.75rem] py-2.5 pl-3.5 pr-8 shadow-drop after:absolute after:right-3 after:top-1/2 after:h-2 after:w-2 after:-translate-y-1/2 after:rounded-full after:bg-black ${top ? "bg-nametag text-white" : "bg-white text-black"}`}
                >
                  <span className={`font-cooper text-3xl leading-none ${top ? "text-white" : "text-nametag"}`}>{tier.percentOff}%</span>
                  <span className="text-sm font-semibold">{describeTierScope(tier)}</span>
                </li>
              );
            })}
          </ul>
          <Countdown endsAt={promotion.endsAt} />
          <Text className="max-w-md !text-white/85">
            Mix and match anything. The discount applies at checkout.
          </Text>
          <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button.Link href="/collections/all" size="lg" className="!w-full sm:!w-auto" rightIcon={<FiArrowRight aria-hidden />}>
              Shop the sale
            </Button.Link>
            <Button.Link href="#collections" size="lg" variant="link" className="!w-full sm:!w-auto">
              Browse collections
            </Button.Link>
          </div>
        </div>
      </div>
      <PhotoWall
        tiles={tiles}
        wrapperClassName="hidden h-full md:block"
        className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] grid-rows-2 gap-1 pl-1"
      />
    </div>
  );
}

/** The sale's name, with its accent (the "RY" in Black RYDay) in name-tag red. */
function SaleName({ promotion: { name, accent } }: { promotion: Promotion }) {
  const at = accent ? name.indexOf(accent) : -1;
  if (!accent || at < 0) return name;
  return (
    <>
      {name.slice(0, at)}
      <span className="text-nametag">{accent}</span>
      {name.slice(at + accent.length)}
    </>
  );
}

const subscribeToSeconds = (onTick: () => void) => {
  const timer = window.setInterval(onTick, 1000);
  return () => window.clearInterval(timer);
};
const currentSecond = () => Math.floor(Date.now() / 1000);
// The server can't know the visitor's second, so the clock fills in after hydration.
const noSecond = () => null;

function Countdown({ endsAt }: { endsAt: string }) {
  const now = useSyncExternalStore(subscribeToSeconds, currentSecond, noSecond);
  const left = now === null ? null : Math.max(0, Math.floor(Date.parse(endsAt) / 1000) - now);
  const parts = [
    { unit: "Days", value: left === null ? null : Math.floor(left / 86400) },
    { unit: "Hrs", value: left === null ? null : Math.floor((left % 86400) / 3600) },
    { unit: "Min", value: left === null ? null : Math.floor((left % 3600) / 60) },
    { unit: "Sec", value: left === null ? null : left % 60 },
  ];
  return (
    // A timer role is not announced on every tick, which a per-second update needs.
    <div role="timer" aria-label="Time left in the sale" className="flex gap-2 tabular-nums">
      {parts.map(({ unit, value }, index) => (
        <div key={unit} className="min-w-14 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-center sm:min-w-16">
          <span className="block font-cooper text-2xl leading-tight text-white">
            {value === null ? "–" : index === 0 ? value : String(value).padStart(2, "0")}
          </span>
          <span className="text-[0.625rem] font-semibold uppercase tracking-caps text-white/70">{unit}</span>
        </div>
      ))}
    </div>
  );
}
