const MAX_TIMEOUT_MS = 2_147_483_647;

/** When a campaign is live. Either bound may be omitted; times are ISO 8601. */
type CampaignWindow = {
  startsAt?: string;
  expiresAt?: string;
};

const isCampaignActive = (
  { startsAt, expiresAt }: CampaignWindow = {},
  now = Date.now(),
) => {
  if (startsAt) {
    const startTime = Date.parse(startsAt);
    if (!Number.isFinite(startTime) || now < startTime) return false;
  }

  if (expiresAt) {
    const expirationTime = Date.parse(expiresAt);
    if (!Number.isFinite(expirationTime) || now >= expirationTime) return false;
  }

  return true;
};

/** The first campaign in the list that is live at `now`. */
const getActiveCampaign = <T extends CampaignWindow>(
  campaigns: readonly T[],
  now = Date.now(),
) => campaigns.find((campaign) => isCampaignActive(campaign, now));

/** The next time any campaign starts or expires, so callers can re-check then. */
const getNextCampaignChange = (
  campaigns: readonly CampaignWindow[],
  now = Date.now(),
) => {
  const upcoming = campaigns
    .flatMap(({ startsAt, expiresAt }) => [startsAt, expiresAt])
    .map((time) => (time ? Date.parse(time) : Number.NaN))
    .filter((time) => Number.isFinite(time) && time > now);

  return upcoming.length ? Math.min(...upcoming) : undefined;
};

export type { CampaignWindow };
export {
  getActiveCampaign,
  getNextCampaignChange,
  isCampaignActive,
  MAX_TIMEOUT_MS,
};
