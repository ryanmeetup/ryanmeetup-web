/**
 * Live shipping quote check. Run `npm run quote:shipping` from apps/store.
 *
 * Reads the published catalog through the Storefront API, picks the heaviest
 * purchasable variant in each Shopify category, and asks Shopify's cart for
 * delivery options in one enabled country per shipping zone (`-- --all` for
 * every enabled country). It also
 * quotes two of the heaviest variant and a cart mixing the two heaviest
 * categories, the cases most likely to fall off a weight tier or a zone.
 *
 * Carts are created with a one-time delivery address and abandoned: no order,
 * payment or Printful job is created. The script exits nonzero when any cart
 * has no shipping option, which is what a buyer would see as "no shipping
 * available". Prices are Shopify's quotes in each market's currency; compare
 * them with Printful's costs by hand, as docs/how-to/shipping-setup.md says.
 */
import path from "node:path";

const root = path.resolve(__dirname, "..");
try {
  process.loadEnvFile(path.join(root, ".env.local"));
} catch {
  // Fall back to variables already in the environment.
}

const domain = process.env.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
const token = process.env.SHOPIFY_STOREFRONT_API_TOKEN;
if (!domain || !token) {
  console.error("Set SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_API_TOKEN (apps/store/.env.local).");
  process.exit(1);
}

type Variant = { id: string; title: string; product: string; category: string; ounces: number };
type Line = { variant: Variant; quantity: number };
type Address = { address1: string; city: string; zip: string; countryCode: string; provinceCode?: string };

/** One enabled country from each zone the store's Printful-based profiles define (Worldwide → SG). */
const zoneRepresentatives = ["US", "CA", "GB", "DE", "CH", "AU", "JP", "SG"];

const ouncesPer: Record<string, number> = { OUNCES: 1, POUNDS: 16, GRAMS: 0.035274, KILOGRAMS: 35.274 };

/** Real public addresses, one per country Shopify may enable; others use the capital-city fallback. */
const addresses: Record<string, Omit<Address, "countryCode">> = {
  US: { address1: "1600 Pennsylvania Ave NW", city: "Washington", provinceCode: "DC", zip: "20500" },
  CA: { address1: "255 Portage Ave", city: "Winnipeg", provinceCode: "MB", zip: "R3B 2B2" },
  AU: { address1: "1 Macquarie St", city: "Sydney", provinceCode: "NSW", zip: "2000" },
  NZ: { address1: "1 Molesworth St", city: "Wellington", zip: "6011" },
  GB: { address1: "10 Downing Street", city: "London", zip: "SW1A 2AA" },
  IE: { address1: "Merrion Street Upper", city: "Dublin", provinceCode: "D", zip: "D02 R583" },
  DE: { address1: "Platz der Republik 1", city: "Berlin", zip: "11011" },
  FR: { address1: "55 Rue du Faubourg Saint-Honoré", city: "Paris", zip: "75008" },
  NL: { address1: "Dam 1", city: "Amsterdam", zip: "1012 JS" },
  BE: { address1: "Rue de la Loi 16", city: "Brussels", zip: "1000" },
  AT: { address1: "Ballhausplatz 2", city: "Vienna", zip: "1010" },
  CH: { address1: "Bundesplatz 3", city: "Bern", zip: "3005" },
  CZ: { address1: "Hradčany 1", city: "Prague", zip: "119 08" },
  DK: { address1: "Prins Jørgens Gård 1", city: "Copenhagen", zip: "1218" },
  ES: { address1: "Calle de Bailén s/n", city: "Madrid", provinceCode: "M", zip: "28071" },
  FI: { address1: "Mariankatu 2", city: "Helsinki", zip: "00170" },
  IT: { address1: "Piazza del Quirinale", city: "Roma", provinceCode: "RM", zip: "00187" },
  NO: { address1: "Karl Johans gate 22", city: "Oslo", zip: "0026" },
  PL: { address1: "Wiejska 4", city: "Warszawa", zip: "00-902" },
  PT: { address1: "Praça do Comércio", city: "Lisboa", provinceCode: "PT-11", zip: "1100-148" },
  SE: { address1: "Riksgatan 1", city: "Stockholm", zip: "100 12" },
  JP: { address1: "1-1 Chiyoda", city: "Chiyoda-ku", provinceCode: "JP-13", zip: "100-8111" },
  KR: { address1: "1 Cheongwadae-ro", city: "Seoul", zip: "03048" },
  HK: { address1: "2 Tim Mei Avenue", city: "Admiralty", provinceCode: "HK", zip: "" },
  SG: { address1: "1 Parliament Place", city: "Singapore", zip: "178880" },
  MY: { address1: "Jalan Parlimen", city: "Kuala Lumpur", provinceCode: "KUL", zip: "50480" },
  IL: { address1: "Kaplan St 1", city: "Jerusalem", zip: "9195016" },
  AE: { address1: "Sheikh Zayed Road", city: "Dubai", provinceCode: "DU", zip: "" },
};

async function storefront<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(`https://${domain}/api/2026-04/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": token! },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await response.json().catch(() => ({}))) as { data?: T; errors?: { message: string; extensions?: { code?: string } }[] };
    // Cart creation is rate limited per client; Shopify reports it as 429 or a THROTTLED GraphQL error.
    const throttled = response.status === 429 || body.errors?.some((error) => error.extensions?.code === "THROTTLED" || /throttled/i.test(error.message));
    if (throttled && attempt < 6) {
      await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
      continue;
    }
    if (!response.ok || body.errors?.length || !body.data) {
      throw new Error(body.errors?.map((error) => error.message).join("; ") ?? `Storefront request failed (${response.status}).`);
    }
    return body.data;
  }
}

async function loadHeaviestByCategory(): Promise<Variant[]> {
  type Page = { products: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: {
    title: string; productType: string; category: { name: string } | null;
    variants: { nodes: { id: string; title: string; availableForSale: boolean; weight: number | null; weightUnit: string }[] };
  }[] } };
  const heaviest = new Map<string, Variant>();
  let after: string | null = null;
  do {
    const page: Page = await storefront<Page>(
      `query($after: String) { products(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { title productType category { name } variants(first: 250) { nodes { id title availableForSale weight weightUnit } } }
      } }`,
      { after },
    );
    for (const product of page.products.nodes) {
      const category = product.category?.name ?? (product.productType || "Uncategorized");
      for (const variant of product.variants.nodes) {
        if (!variant.availableForSale) continue;
        const ounces = (variant.weight ?? 0) * (ouncesPer[variant.weightUnit] ?? 0);
        if (ounces > (heaviest.get(category)?.ounces ?? -1)) {
          heaviest.set(category, { id: variant.id, title: variant.title, product: product.title, category, ounces });
        }
      }
    }
    after = page.products.pageInfo.hasNextPage ? page.products.pageInfo.endCursor : null;
  } while (after);
  return [...heaviest.values()].sort((a, b) => b.ounces - a.ounces);
}

async function quote(lines: Line[], countryCode: string): Promise<string[]> {
  const address = { ...(addresses[countryCode] ?? { address1: "1 Main Street", city: "Capital", zip: "00000" }), countryCode };
  type Result = { cartCreate: { userErrors: { message: string }[]; cart: { deliveryGroups: { nodes: {
    deliveryOptions: { title: string; estimatedCost: { amount: string; currencyCode: string } }[];
  }[] } } | null } };
  const data = await storefront<Result>(
    `mutation($country: CountryCode!, $input: CartInput!) @inContext(country: $country) {
      cartCreate(input: $input) {
        userErrors { message }
        cart { deliveryGroups(first: 10) { nodes { deliveryOptions { title estimatedCost { amount currencyCode } } } } }
      }
    }`,
    {
      country: countryCode,
      input: {
        lines: lines.map(({ variant, quantity }) => ({ merchandiseId: variant.id, quantity })),
        buyerIdentity: { countryCode },
        delivery: { addresses: [{ address: { deliveryAddress: { ...address, firstName: "Quote", lastName: "Check" } }, selected: true, oneTimeUse: true }] },
      },
    },
  );
  const { cart, userErrors } = data.cartCreate;
  if (userErrors.length) throw new Error(userErrors.map((error) => error.message).join("; "));
  // A cart split across profiles returns one group per shipment; a buyer pays the cheapest option in each.
  return (cart?.deliveryGroups.nodes ?? []).map((group) => {
    const cheapest = [...group.deliveryOptions].sort((a, b) => Number(a.estimatedCost.amount) - Number(b.estimatedCost.amount))[0];
    return cheapest ? `${cheapest.estimatedCost.amount} ${cheapest.estimatedCost.currencyCode}` : "";
  });
}

async function main() {
  const { localization } = await storefront<{ localization: { availableCountries: { isoCode: string }[] } }>(
    "{ localization { availableCountries { isoCode } } }",
  );
  const enabled = localization.availableCountries.map((country) => country.isoCode).sort();
  // Every country in a profile zone pays the same rate, so one country per zone
  // proves the zone exists. Pass --all after a Markets change to check each one.
  const countries = process.argv.includes("--all") ? enabled : enabled.filter((country) => zoneRepresentatives.includes(country));
  const heaviest = await loadHeaviestByCategory();
  if (!heaviest.length) throw new Error("No purchasable variants with weights were found.");

  const cases: { label: string; lines: Line[] }[] = heaviest.map((variant) => ({
    label: `${variant.category}: ${variant.product} (${variant.title}, ${variant.ounces.toFixed(1)} oz)`,
    lines: [{ variant, quantity: 1 }],
  }));
  cases.push({ label: `Two of the heaviest: ${heaviest[0].product}`, lines: [{ variant: heaviest[0], quantity: 2 }] });
  if (heaviest[1]) {
    cases.push({ label: `Mixed: ${heaviest[0].product} + ${heaviest[1].product}`, lines: [{ variant: heaviest[0], quantity: 1 }, { variant: heaviest[1], quantity: 1 }] });
  }

  console.log(`Quoting ${cases.length} carts to ${countries.length} countries: ${countries.join(", ")}\n`);
  const failures: string[] = [];
  for (const { label, lines } of cases) {
    console.log(label);
    // Sequential on purpose: parallel cart creation trips Shopify's throttle.
    for (const country of countries) {
      let result: string;
      try {
        const groups = await quote(lines, country);
        if (!groups.length || groups.some((group) => !group)) failures.push(`${label} → ${country}: no shipping option`);
        result = groups.length ? groups.map((group) => group || "NONE").join(" + ") : "NONE";
      } catch (error) {
        failures.push(`${label} → ${country}: ${(error as Error).message}`);
        result = "ERROR";
      }
      console.log(`  ${country} ${result}`);
      // Pace cart creation: a burst gets this client throttled for several minutes.
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    console.log("");
  }

  if (failures.length) {
    console.error(`${failures.length} cart(s) could not ship:\n${failures.map((failure) => `  - ${failure}`).join("\n")}`);
    process.exit(1);
  }
  console.log("Every cart has a shipping option in every enabled country.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
