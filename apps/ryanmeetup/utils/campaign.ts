const MAX_TIMEOUT_MS = 2_147_483_647;

const isCampaignActive = (expiresAt?: string, now = Date.now()) => {
  if (!expiresAt) return true;

  const expirationTime = Date.parse(expiresAt);
  return Number.isFinite(expirationTime) && now < expirationTime;
};

export { isCampaignActive, MAX_TIMEOUT_MS };
