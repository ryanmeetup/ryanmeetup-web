import type { CampaignWindow } from "@/utils/campaign";

export type BannerPalette = "sunset" | "ink";

export type SiteBanner = CampaignWindow & {
  /** Stable identifier, used as the React key. */
  id: string;
  message: string;
  href: string;
  actionLabel: string;
  /** Accessible name for the announcement region. */
  ariaLabel: string;
  palette: BannerPalette;
  /**
   * Required so no banner outlives its campaign. Use an ISO 8601 time with an
   * explicit offset; the banner disappears at this instant.
   */
  expiresAt: string;
};

/**
 * Site-wide announcements shown above the header. The first entry whose
 * `startsAt`/`expiresAt` window contains the current time is shown, so order
 * by priority. Expired entries hide themselves and can be pruned at leisure.
 */
export const siteBanners: SiteBanner[] = [
  {
    id: "ryd-sales-2026",
    message:
      "RY-Ds are back! Order your own anodized membership card, Ryan Pre-Check included.",
    href: "/cards",
    actionLabel: "Order",
    ariaLabel: "RY-D membership cards are on sale again",
    palette: "ink",
    expiresAt: "2026-11-09T00:00:00-05:00",
  },
];
