"use client";

import { useEffect, useState } from "react";

import { isCampaignActive, MAX_TIMEOUT_MS } from "@/utils/campaign";

const useCampaignActive = (expiresAt?: string) => {
  const [isActive, setIsActive] = useState(!expiresAt);

  useEffect(() => {
    if (!expiresAt) {
      setIsActive(true);
      return;
    }

    const expirationTime = Date.parse(expiresAt);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const updateVisibility = () => {
      const remainingTime = expirationTime - Date.now();
      setIsActive(isCampaignActive(expiresAt));

      if (remainingTime > 0) {
        timeoutId = setTimeout(
          updateVisibility,
          Math.min(remainingTime, MAX_TIMEOUT_MS),
        );
      }
    };

    updateVisibility();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [expiresAt]);

  return isActive;
};

export { useCampaignActive };
