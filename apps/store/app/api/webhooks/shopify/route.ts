import { revalidateTag } from "next/cache";
import { shopifyCatalogTag } from "@/lib/shopify-cache";
import { handleCatalogWebhook } from "@/lib/shopify-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleCatalogWebhook(request, () => revalidateTag(shopifyCatalogTag, { expire: 0 }));
}
