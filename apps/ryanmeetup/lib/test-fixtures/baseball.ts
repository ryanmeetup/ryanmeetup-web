import type { MerchCollection } from "@/actions/fetchShopify";
import type { BaseballTeam, ContentfulImage } from "@/lib/types";

const createLogo = (url: string): ContentfulImage =>
  ({
    fields: {
      title: "Team logo",
      description: "",
      file: {
        url,
        fileName: "logo.png",
        contentType: "image/png",
        details: {
          image: {
            height: 512,
            width: 512,
          },
          size: 1,
        },
      },
    },
  }) as ContentfulImage;

const logo = createLogo("/icons/map/ryanicon.png");

// Made-up teams on real coordinates. The Manchester team covers Vermont and
// Maine so the "also serves" behaviour has something to exercise.
const getBaseballFixtures = (): BaseballTeam[] => [
  {
    name: "Manchester Ryanlanders",
    slug: "manchester-ryanlanders",
    logo,
    city: "Manchester",
    state: "NH",
    venue: "Riverside Park",
    coordinates: { lat: 42.9956, lon: -71.4548 },
    gameDate: "2027-06-12",
    ticketUrl: "https://example.com/tickets/manchester",
    servesStates: ["VT", "ME"],
    servesCities: ["Burlington"],
  },
  {
    name: "Worcester Ryan Sox",
    slug: "worcester-ryan-sox",
    logo,
    city: "Worcester",
    state: "MA",
    venue: "Canal District Field",
    coordinates: { lat: 42.2626, lon: -71.8023 },
    gameDate: "2027-06-19",
    ticketUrl: "https://example.com/tickets/worcester",
  },
  {
    name: "Hartford Ryan Goats",
    slug: "hartford-ryan-goats",
    logo,
    city: "Hartford",
    state: "CT",
    coordinates: { lat: 41.7658, lon: -72.6734 },
    gameDate: "2027-06-26",
    ticketUrl: "https://example.com/tickets/hartford",
    servesStates: ["RI"],
    servesCities: ["Providence"],
  },
  {
    name: "Albany Ryan Valley",
    slug: "albany-ryan-valley",
    logo,
    city: "Albany",
    state: "NY",
    coordinates: { lat: 42.6526, lon: -73.7562 },
    gameDate: "2027-07-03",
    ticketUrl: "https://example.com/tickets/albany",
  },
  {
    name: "Columbus Clip-Ryans",
    slug: "columbus-clip-ryans",
    logo,
    city: "Columbus",
    state: "OH",
    coordinates: { lat: 39.9612, lon: -82.9988 },
    gameDate: "2027-07-10",
    ticketUrl: "https://example.com/tickets/columbus",
  },
  {
    name: "Sacramento River Ryans",
    slug: "sacramento-river-ryans",
    logo,
    city: "Sacramento",
    state: "CA",
    coordinates: { lat: 38.5816, lon: -121.4944 },
    gameDate: "2027-07-10",
    ticketUrl: "https://example.com/tickets/sacramento",
  },
];

/** Postcode centroids the geocode route answers with while E2E_TESTS is on. */
const baseballZipFixtures: Record<string, { lat: number; lon: number; label: string }> = {
  "01608": { lat: 42.2626, lon: -71.8023, label: "Worcester, Massachusetts" },
  "05401": { lat: 44.4759, lon: -73.2121, label: "Burlington, Vermont" },
  "95814": { lat: 38.5806, lon: -121.4936, label: "Sacramento, California" },
};

const getBaseballMerchFixture = (): MerchCollection => ({
  title: "Baseball Classic",
  href: "https://store.ryanmeetup.com/collections/baseball-classic",
  products: ["Classic Jersey", "Classic Cap", "Foam Finger", "Pennant"].map(
    (title, index) => ({
      id: `fixture-${index}`,
      title,
      href: `https://store.ryanmeetup.com/products/fixture-${index}`,
      image: { url: "/icons/map/ryanicon.png", altText: null, width: 512, height: 512 },
      price: { amount: String(20 + index * 5), currencyCode: "USD" },
    }),
  ),
});

export { baseballZipFixtures, getBaseballFixtures, getBaseballMerchFixture };
