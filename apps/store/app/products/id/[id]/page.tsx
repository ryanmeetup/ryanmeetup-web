import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getProductCardsByIds } from "@/lib/shopify";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { robots: { index: false } };

/**
 * Reviews record a product by its numeric Shopify ID, not its handle, so tools
 * outside the store (Tasks review moderation) link here and land on the
 * product's canonical page. Unpublished and deleted products have no page.
 */
export default async function ProductByIdPage({ params }: Props) {
  const { id } = await params;
  const card = (await getProductCardsByIds([id]))[id];
  if (!card) notFound();
  redirect(card.href ?? `/products/${card.handle}`);
}
