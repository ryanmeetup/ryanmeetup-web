import { baseballZipFixtures } from "@/lib/test-fixtures/baseball";
import { isValidZip } from "@/utils/baseball";

const GEOCODE_REVALIDATE_SECONDS = 60 * 60 * 24 * 30;

type MapboxFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { full_address?: string; place_formatted?: string; name?: string };
};

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers:
      status === 200
        ? { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=86400" }
        : undefined,
  });

/**
 * Turns a US zip code into a centroid for the Baseball Classic finder.
 *
 * A URL-restricted public Mapbox token rejects requests that carry no browser
 * Referer, so `MAPBOX_GEOCODING_TOKEN` can supply an unrestricted server-only
 * token; without it the public map token is tried.
 */
export async function GET(request: Request) {
  const zip = new URL(request.url).searchParams.get("zip")?.trim() ?? "";

  if (!isValidZip(zip)) {
    return json({ error: "Enter a five-digit US zip code." }, 400);
  }

  if (process.env.E2E_TESTS === "true") {
    const fixture = baseballZipFixtures[zip];
    return fixture
      ? json(fixture)
      : json({ error: "We couldn't find that zip code." }, 404);
  }

  const token =
    process.env.MAPBOX_GEOCODING_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return json({ error: "Zip search isn't available right now." }, 503);
  }

  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", zip);
  url.searchParams.set("types", "postcode");
  url.searchParams.set("country", "us");
  url.searchParams.set("limit", "1");
  url.searchParams.set("access_token", token);

  const response = await fetch(url, {
    next: { revalidate: GEOCODE_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    console.error(`Mapbox geocoding failed with ${response.status}`);
    return json({ error: "Zip search isn't available right now." }, 502);
  }

  const data = (await response.json()) as { features?: MapboxFeature[] };
  const feature = data.features?.[0];
  const coordinates = feature?.geometry?.coordinates;

  if (!coordinates) {
    return json({ error: "We couldn't find that zip code." }, 404);
  }

  const [lon, lat] = coordinates;
  const label =
    feature?.properties?.place_formatted ??
    feature?.properties?.full_address ??
    zip;

  return json({ lat, lon, label });
}
