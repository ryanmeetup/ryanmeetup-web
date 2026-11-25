/**
 * Purchase-option audit. Run `npm run audit:purchase-options` from apps/store.
 *
 * Compares every active Shopify variant (Admin API) with what the storefront's
 * product pages let a shopper pick, using the same listing and color-picker
 * logic as the site. It reports:
 *
 * - active products missing from the Ryan Meetup Store Headless channel, which
 *   the storefront cannot see at all;
 * - published products that land in no listing;
 * - variants no Style, Color, or option dropdown can reach, such as a color a
 *   color-chosen listing leaves out of its picker;
 * - variants the Storefront fetch cut off (it reads 100 variants per product);
 * - variants whose availability differs between Admin and the storefront.
 *
 * Read-only. Exits nonzero when anything is unreachable or mismatched.
 */
import path from "node:path";

const root = path.resolve(__dirname, "..");
try {
  process.loadEnvFile(path.join(root, ".env.local"));
} catch {
  // Fall back to variables already in the environment.
}

const headlessChannel = "Ryan Meetup Store Headless";
const domain = process.env.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
const clientId = process.env.SHOPIFY_ADMIN_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_ADMIN_CLIENT_SECRET;
if (!domain || !clientId || !clientSecret || !process.env.SHOPIFY_STOREFRONT_API_TOKEN) {
  console.error("Set SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_API_TOKEN, SHOPIFY_ADMIN_CLIENT_ID and SHOPIFY_ADMIN_CLIENT_SECRET (apps/store/.env.local).");
  process.exit(1);
}

type AdminVariant = { id: string; title: string; sellable: boolean };
type AdminProduct = { id: string; handle: string; title: string; status: string; headless: boolean; variants: AdminVariant[] };
type AdminPage = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: {
      id: string; handle: string; title: string; status: string;
      resourcePublicationsV2: { nodes: { publication: { name: string } }[] };
      variants: { nodes: { id: string; title: string; inventoryPolicy: string; inventoryQuantity: number | null; inventoryItem: { tracked: boolean } }[] };
    }[];
  };
};

async function getAdminToken() {
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: clientId!, client_secret: clientSecret! });
  const response = await fetch(`https://${domain}/admin/oauth/access_token`, { method: "POST", body });
  if (!response.ok) throw new Error(`Admin token request failed: ${response.status}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

async function getAdminProducts(): Promise<AdminProduct[]> {
  const token = await getAdminToken();
  const products: AdminProduct[] = [];
  let after: string | null = null;
  do {
    const response = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query AuditProducts($after: String) {
          products(first: 50, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id handle title status
              resourcePublicationsV2(first: 10) { nodes { publication { name } } }
              variants(first: 250) { nodes { id title inventoryPolicy inventoryQuantity inventoryItem { tracked } } }
            }
          }
        }`,
        variables: { after },
      }),
    });
    const result = (await response.json()) as { data?: AdminPage; errors?: unknown };
    if (!result.data) throw new Error(`Admin query failed: ${JSON.stringify(result.errors)}`);
    for (const node of result.data.products.nodes) {
      products.push({
        id: node.id,
        handle: node.handle,
        title: node.title,
        status: node.status,
        headless: node.resourcePublicationsV2.nodes.some(({ publication }) => publication.name === headlessChannel),
        variants: node.variants.nodes.map((variant) => ({
          id: variant.id,
          title: variant.title,
          sellable: !variant.inventoryItem.tracked || variant.inventoryPolicy === "CONTINUE" || (variant.inventoryQuantity ?? 0) > 0,
        })),
      });
    }
    after = result.data.products.pageInfo.hasNextPage ? result.data.products.pageInfo.endCursor : null;
  } while (after);
  return products;
}

async function main() {
  // Imported after the environment loads, since the Shopify client reads it.
  const { getProduct, getProductHandles } = await import("../lib/shopify");
  const { getColorOption, getListingColors } = await import("../lib/product-colors");

  const reachable = new Set<string>();
  const listed = new Set<string>();
  const storefrontAvailability = new Map<string, boolean>();
  const problems: string[] = [];

  for (const handle of await getProductHandles()) {
    const listing = await getProduct(handle);
    if (!listing) {
      problems.push(`Listing ${handle} did not load.`);
      continue;
    }
    const designs = listing.designs ?? [{ product: listing, label: listing.title, value: listing.handle }];
    const colors = listing.designs ? getListingColors(listing.designs) : undefined;
    for (const design of designs) {
      const product = design.product;
      listed.add(product.id);
      for (const variant of product.variants) storefrontAvailability.set(variant.id, variant.availableForSale);
      const colorOption = getColorOption(product);
      // A color-chosen listing reaches a member only through its entries in the Color picker.
      const pickerColors = colors?.filter((entry) => entry.design === design.value);
      if (pickerColors && !pickerColors.length) {
        problems.push(`${listing.title}: ${product.title} has no entry in the Color picker.`);
        continue;
      }
      const allowed = pickerColors && colorOption ? new Set(pickerColors.map(({ color }) => color)) : null;
      for (const variant of product.variants) {
        const offered = variant.selectedOptions.every((selected) => product.options.find((option) => option.name === selected.name)?.values.includes(selected.value) ?? true);
        const color = colorOption && variant.selectedOptions.find((selected) => selected.name === colorOption.name)?.value;
        if (!offered) problems.push(`${listing.title}: ${product.title} / ${variant.title} uses a value missing from its options.`);
        else if (allowed && color && !allowed.has(color)) problems.push(`${listing.title}: ${product.title} / ${color} is missing from the Color picker.`);
        else reachable.add(variant.id);
      }
    }
  }

  const products = await getAdminProducts();
  const active = products.filter((product) => product.status === "ACTIVE");
  for (const product of active) {
    if (!product.headless) {
      problems.push(`${product.title} (${product.handle}) is not published to ${headlessChannel}.`);
      continue;
    }
    if (!listed.has(product.id)) {
      problems.push(`${product.title} (${product.handle}) appears in no listing.`);
      continue;
    }
    for (const variant of product.variants) {
      if (!storefrontAvailability.has(variant.id)) problems.push(`${product.title} / ${variant.title} was cut off by the Storefront fetch.`);
      else if (!reachable.has(variant.id)) continue; // Already reported above with its reason.
      else if (storefrontAvailability.get(variant.id) !== variant.sellable) {
        problems.push(`${product.title} / ${variant.title}: Admin says ${variant.sellable ? "in stock" : "sold out"}, the storefront says ${variant.sellable ? "sold out" : "in stock"}.`);
      }
    }
  }

  const variantCount = active.reduce((total, product) => total + product.variants.length, 0);
  console.log(`${active.length} active products, ${variantCount} variants; ${reachable.size} reachable from product pages.`);
  const hidden = products.filter((product) => product.status !== "ACTIVE");
  if (hidden.length) console.log(`Not active (intentionally hidden?): ${hidden.map((product) => `${product.title} [${product.status.toLowerCase()}]`).join(", ")}`);
  if (problems.length) {
    console.log(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
    for (const problem of problems) console.log(`- ${problem}`);
    process.exitCode = 1;
  } else {
    console.log("Every active variant can be bought from its product page.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
