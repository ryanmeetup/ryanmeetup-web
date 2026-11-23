import type { Location } from "@/lib/types";
import { createImage } from "@/lib/test-fixtures/images";

const getMapFixtures = (): Location[] => [
  {
    locationName: "New York, NY",
    coordinates: { lat: 40.7128, lon: -74.006 },
    eventName: "Ryan Roundup",
    eventDate: new Date(),
    image: createImage("ryanroundup.png"),
    city: "New York, NY",
    locationType: "Event Location",
  },
  {
    locationName: "Chicago, IL",
    coordinates: { lat: 41.8781, lon: -87.6298 },
    eventName: "Ryan Hub",
    eventDate: new Date(),
    image: createImage("ryanroundup.png"),
    city: "Chicago, IL",
    locationType: "Ryan Hub",
  },
  {
    locationName: "Austin, TX",
    coordinates: { lat: 30.2672, lon: -97.7431 },
    eventName: "Ryan's Coffee",
    eventDate: new Date(),
    image: createImage("ryanroundup.png"),
    city: "Austin, TX",
    locationType: "Ryan-Named Business",
  },
  {
    locationName: "Denver, CO",
    coordinates: { lat: 39.7392, lon: -104.9903 },
    eventName: "Ryan's Garage",
    eventDate: new Date(),
    image: createImage("ryanroundup.png"),
    city: "Denver, CO",
    locationType: "Ryan-Owned Business",
  },
  {
    locationName: "Seattle, WA",
    coordinates: { lat: 47.6062, lon: -122.3321 },
    eventName: "Ryan Meetup Chapter",
    eventDate: new Date(),
    image: createImage("ryanroundup.png"),
    city: "Seattle, WA",
    locationType: "Chapter",
  },
];

export { getMapFixtures };
