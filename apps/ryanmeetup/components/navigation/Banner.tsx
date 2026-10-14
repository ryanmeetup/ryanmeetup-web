"use client";

import { Banner as SharedBanner, Button } from "@ryanmeetup/ui";
import { usePathname } from "next/navigation";
import { useActiveCampaign } from "@/components/global/useCampaignActive";

// Types
import type { CSSProperties } from "react";
import type { BannerPalette, SiteBanner } from "@/lib/banners";

export type BannerProps = {
  banners: readonly SiteBanner[];
  className?: string;
};

// The shared Banner's variant classes win the cascade over app overrides, so
// each palette sets its fixed surface colours inline as well.
const palettes: Record<
  BannerPalette,
  {
    banner: string;
    bannerStyle: CSSProperties;
    action: string;
    actionStyle: CSSProperties;
  }
> = {
  sunset: {
    banner: "border-[#f6c500]/40 bg-[#ef3d23] text-[#f4f0df]",
    bannerStyle: {
      backgroundColor: "#ef3d23",
      borderColor: "rgba(246, 197, 0, 0.4)",
      color: "#f4f0df",
    },
    action:
      "border-[#f6c500] bg-[#f6c500] text-[#4b210f] hover:border-[#ffe168] hover:bg-[#ffe168]",
    actionStyle: {
      backgroundColor: "#f6c500",
      borderColor: "#f6c500",
      color: "#4b210f",
    },
  },
  ink: {
    banner: "border-white/10 bg-black text-white",
    bannerStyle: {
      backgroundColor: "#000000",
      borderColor: "rgba(255, 255, 255, 0.1)",
      color: "#ffffff",
    },
    action: "border-white bg-white text-black hover:border-white/80 hover:bg-white/80",
    actionStyle: {
      backgroundColor: "#ffffff",
      borderColor: "#ffffff",
      color: "#000000",
    },
  },
};

/**
 * Site-wide announcement above the header. Shows the first banner in
 * `lib/banners.ts` whose schedule is live, and hides it on the page it links to.
 */
export function Banner({ banners, className = "" }: BannerProps) {
  const banner = useActiveCampaign(banners);
  const pathname = usePathname();

  if (!banner || pathname === banner.href) return null;

  const palette = palettes[banner.palette];

  return (
    <SharedBanner
      key={banner.id}
      variant="neutral"
      aria-label={banner.ariaLabel}
      className={`${className} ${palette.banner} font-cooper !text-xl`}
      style={palette.bannerStyle}
      action={
        <Button.Link
          href={banner.href}
          size="sm"
          variant="secondary"
          className={`whitespace-nowrap ${palette.action}`}
          style={palette.actionStyle}
        >
          {banner.actionLabel}
        </Button.Link>
      }
    >
      <p>{banner.message}</p>
    </SharedBanner>
  );
}
