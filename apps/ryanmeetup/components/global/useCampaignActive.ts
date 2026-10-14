"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getActiveCampaign,
  getNextCampaignChange,
  MAX_TIMEOUT_MS,
} from "@/utils/campaign";

import type { CampaignWindow } from "@/utils/campaign";

/**
 * The first campaign that is live right now, re-checked whenever any of them
 * starts or expires. Undated campaigns render on the server; dated ones wait
 * for the client clock.
 */
const useActiveCampaign = <T extends CampaignWindow>(
  campaigns: readonly T[],
) => {
  const [activeCampaign, setActiveCampaign] = useState<T | undefined>(() =>
    campaigns.find((campaign) => !campaign.startsAt && !campaign.expiresAt),
  );

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const update = () => {
      const now = Date.now();
      setActiveCampaign(getActiveCampaign(campaigns, now));

      const nextChange = getNextCampaignChange(campaigns, now);
      if (nextChange !== undefined) {
        timeoutId = setTimeout(
          update,
          Math.min(nextChange - now, MAX_TIMEOUT_MS),
        );
      }
    };

    update();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [campaigns]);

  return activeCampaign;
};

const useCampaignActive = ({ startsAt, expiresAt }: CampaignWindow = {}) => {
  const campaigns = useMemo(
    () => [{ startsAt, expiresAt }],
    [startsAt, expiresAt],
  );

  return useActiveCampaign(campaigns) !== undefined;
};

export { useActiveCampaign, useCampaignActive };
