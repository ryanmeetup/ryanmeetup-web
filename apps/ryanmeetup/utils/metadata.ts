import { createPageMetadataBuilder } from "@ryanmeetup/metadata";

const SITE_NAME = "Ryan Meetup";
const SITE_URL = "https://ryanmeetup.com";

const buildPageMetadata = createPageMetadataBuilder({
  siteName: SITE_NAME,
  siteUrl: SITE_URL,
});

export { buildPageMetadata, SITE_NAME, SITE_URL };
