import { revalidateTag } from "next/cache";
import { shopifyCatalogTag } from "@/lib/cache-tags";
import { forgetOrderActivity, recordOrderActivity } from "@/lib/product-activity";
import { handleCatalogWebhook } from "@/lib/shopify-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleCatalogWebhook(request, () => revalidateTag(shopifyCatalogTag, { expire: 0 }), {
    record: (order) => recordOrderActivity(order),
    forget: (order) => forgetOrderActivity(order),
  });
}
